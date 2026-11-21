-- ============================================================================
-- CIVICFIX: LOCAL INFRASTRUCTURE COMPLAINT MANAGEMENT PLATFORM
-- Database Schema for Supabase / PostgreSQL
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL,
    description TEXT,
    contact_email VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(50),
    sla_hours INTEGER NOT NULL DEFAULT 48, -- Target resolution time in hours
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'alert-circle',
    default_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    keywords TEXT[] DEFAULT '{}', -- Keywords used by AI categorization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(30) NOT NULL CHECK (role IN ('citizen', 'moderator', 'department_rep', 'admin')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL, -- for department_rep
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. LOCATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    locality_name VARCHAR(150) NOT NULL,
    ward_number VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    landmark TEXT,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. COMPLAINTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_number VARCHAR(30) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_url TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_people VARCHAR(30) NOT NULL CHECK (affected_people IN ('1-10', '10-50', '50-200', '200+')),
    priority_score DECIMAL(5, 2) DEFAULT 1.0,
    priority_level VARCHAR(20) DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected')),
    is_escalated BOOLEAN DEFAULT FALSE,
    escalation_reason TEXT,
    parent_complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL, -- for duplicates linking
    duplicate_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ----------------------------------------------------------------------------
-- 6. ATTACHMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size_kb INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. ASSIGNMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    assigned_to_rep_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(30) DEFAULT 'assigned'
);

-- ----------------------------------------------------------------------------
-- 8. STATUS_HISTORY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    notification_type VARCHAR(50) DEFAULT 'status_update',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR PERFORMANCE & GEOSPATIAL SEARCH
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_department ON complaints(department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category_id);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_coords ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_locations_ward ON locations(ward_number);

-- ----------------------------------------------------------------------------
-- PRIORITY SCORE CALCULATION FUNCTION
-- Score = (Severity_Weight * 2.5) + (Affected_Weight * 1.5) + (Days_Open * 0.5) + (Duplicates * 1.0)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_priority_score(
    p_severity VARCHAR,
    p_affected VARCHAR,
    p_created_at TIMESTAMP WITH TIME ZONE,
    p_duplicate_count INTEGER
)
RETURNS TABLE (score DECIMAL(5,2), level VARCHAR) AS $$
DECLARE
    sev_w INTEGER := 1;
    aff_w INTEGER := 1;
    days_open NUMERIC := 0;
    calc_score DECIMAL(5,2);
    calc_level VARCHAR(20);
BEGIN
    -- Severity weight
    IF p_severity = 'critical' THEN sev_w := 4;
    ELSIF p_severity = 'high' THEN sev_w := 3;
    ELSIF p_severity = 'medium' THEN sev_w := 2;
    ELSE sev_w := 1;
    END IF;

    -- Affected people weight
    IF p_affected = '200+' THEN aff_w := 4;
    ELSIF p_affected = '50-200' THEN aff_w := 3;
    ELSIF p_affected = '10-50' THEN aff_w := 2;
    ELSE aff_w := 1;
    END IF;

    -- Days open
    days_open := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 86400.0);

    -- Priority Score Formula
    calc_score := (sev_w * 2.5) + (aff_w * 1.5) + (days_open * 0.5) + (COALESCE(p_duplicate_count, 0) * 1.0);

    -- Level assignment
    IF calc_score >= 12.0 THEN calc_level := 'urgent';
    ELSIF calc_score >= 8.5 THEN calc_level := 'high';
    ELSIF calc_score >= 5.0 THEN calc_level := 'medium';
    ELSE calc_level := 'low';
    END IF;

    RETURN QUERY SELECT calc_score, calc_level;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- SEED DATA: DEPARTMENTS
-- ----------------------------------------------------------------------------
INSERT INTO departments (id, name, code, description, contact_email, contact_phone, sla_hours) VALUES
('11111111-1111-1111-1111-111111111101', 'Solid Waste Management', 'SWM', 'Garbage collection, waste disposal, community bins, dumping site sanitation', 'waste@civicfix.org', '+1-555-0191', 48),
('11111111-1111-1111-1111-111111111102', 'Water Supply & Sewerage Board', 'WSSB', 'Drainage overflow, sewer lines, drinking water pipeline leaks, storm drains', 'water.sewage@civicfix.org', '+1-555-0192', 48),
('11111111-1111-1111-1111-111111111103', 'Public Works Department', 'PWD', 'Road repairs, potholes, sidewalks, bridges, damaged dividers and railings', 'pwd@civicfix.org', '+1-555-0193', 72),
('11111111-1111-1111-1111-111111111104', 'City Electricity & Power Dept', 'CEPD', 'Broken streetlights, dangling live wires, damaged electrical poles and junction boxes', 'power.lighting@civicfix.org', '+1-555-0194', 24),
('11111111-1111-1111-1111-111111111105', 'Parks & Urban Amenities', 'PUAD', 'Public park upkeep, fallen trees, damaged public benches, playground equipment', 'amenities@civicfix.org', '+1-555-0195', 96)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- SEED DATA: CATEGORIES
-- ----------------------------------------------------------------------------
INSERT INTO categories (id, name, code, description, icon, default_department_id, keywords) VALUES
('22222222-2222-2222-2222-222222222201', 'Garbage & Sanitation', 'GARBAGE', 'Overflowing dumpsters, illegal trash dumping, littered public places', 'trash-2', '11111111-1111-1111-1111-111111111101', ARRAY['garbage', 'trash', 'waste', 'dumpster', 'smell', 'odor', 'bin', 'litter', 'plastic', 'refuse']),
('22222222-2222-2222-2222-222222222202', 'Drainage & Water Logging', 'DRAINAGE', 'Clogged storm drains, overflowing sewers, stagnant dirty water, gutter blockages', 'droplet', '11111111-1111-1111-1111-111111111102', ARRAY['drain', 'drainage', 'sewage', 'water logging', 'flood', 'gutter', 'manhole', 'overflow', 'sewer', 'stagnant', 'pipe leak']),
('22222222-2222-2222-2222-222222222203', 'Roads & Potholes', 'ROADS', 'Dangerous potholes, broken asphalt, damaged pavements, road cave-ins', 'alert-triangle', '11111111-1111-1111-1111-111111111103', ARRAY['pothole', 'road', 'asphalt', 'crater', 'pavement', 'sidewalk', 'tar', 'crack', 'footpath', 'curb', 'divider']),
('22222222-2222-2222-2222-222222222204', 'Streetlights & Electrical', 'ELECTRICAL', 'Flickering or broken streetlights, dark alleys, exposed electric cables, broken poles', 'zap', '11111111-1111-1111-1111-111111111104', ARRAY['streetlight', 'light', 'dark', 'bulb', 'wire', 'pole', 'electric', 'cable', 'transformer', 'shock', 'junction box']),
('22222222-2222-2222-2222-222222222205', 'Public Infrastructure & Parks', 'INFRASTRUCTURE', 'Broken public benches, damaged bus shelters, collapsed boundary walls, playground hazards', 'tool', '11111111-1111-1111-1111-111111111105', ARRAY['park', 'bench', 'shelter', 'bus stop', 'railing', 'playground', 'swing', 'fence', 'tree', 'branch', 'signboard'])
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- SEED DATA: USERS (DEMO ACCOUNTS FOR ALL 4 ROLES)
-- ----------------------------------------------------------------------------
INSERT INTO users (id, email, full_name, phone, role, department_id) VALUES
('33333333-3333-3333-3333-333333333301', 'citizen@civicfix.org', 'John Citizen', '+1-555-0101', 'citizen', NULL),
('33333333-3333-3333-3333-333333333302', 'moderator@civicfix.org', 'Sarah Jenkins (Lead Moderator)', '+1-555-0102', 'moderator', NULL),
('33333333-3333-3333-3333-333333333303', 'rep.pwd@civicfix.org', 'Carlos Mendez (PWD Rep)', '+1-555-0103', 'department_rep', '11111111-1111-1111-1111-111111111103'),
('33333333-3333-3333-3333-333333333304', 'rep.swm@civicfix.org', 'Priya Sharma (Sanitation Rep)', '+1-555-0104', 'department_rep', '11111111-1111-1111-1111-111111111101'),
('33333333-3333-3333-3333-333333333305', 'rep.wssb@civicfix.org', 'Michael Torres (Drainage Rep)', '+1-555-0105', 'department_rep', '11111111-1111-1111-1111-111111111102'),
('33333333-3333-3333-3333-333333333306', 'admin@civicfix.org', 'Eleanor Vance (City Admin)', '+1-555-0100', 'admin', NULL)
ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------------------
-- SEED DATA: LOCATIONS
-- ----------------------------------------------------------------------------
INSERT INTO locations (id, locality_name, ward_number, address, landmark, latitude, longitude) VALUES
('44444444-4444-4444-4444-444444444401', 'Central Market Road', 'Ward 4', '142 Market Street, near Old Clock Tower', 'Opposite City Mart', 37.7749, -122.4194),
('44444444-4444-4444-4444-444444444402', 'Central Market Alley', 'Ward 4', '158 Market Street, Behind Produce Market', 'Behind Daily Fresh Grocers', 37.7752, -122.4190), -- Near 4401 (duplicate test!)
('44444444-4444-4444-4444-444444444403', 'North Oak Avenue', 'Ward 7', '89 North Oak Blvd & 4th Cross', 'Near High School Gate', 37.7833, -122.4167),
('44444444-4444-4444-4444-444444444404', 'Greenwood Park Sector', 'Ward 2', 'Community Park North Entrance, Elm Street', 'Next to Children Play Area', 37.7690, -122.4467),
('44444444-4444-4444-4444-444444444405', 'South Industrial Area', 'Ward 11', 'Plot 24, Transit Link Expressway', 'Near Power Substation 3', 37.7550, -122.4220),
('44444444-4444-4444-4444-444444444406', 'Sunset Boulevard East', 'Ward 5', '620 Sunset Avenue, Corner 12th St', 'Near Metro Station Exit 2', 37.7600, -122.4350)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- SEED DATA: REALISTIC COMPLAINTS (COVERING ALL STATUSES & DUPLICATE DEMO)
-- ----------------------------------------------------------------------------
INSERT INTO complaints (
    id, tracking_number, title, description, category_id, department_id, location_id, citizen_id,
    photo_url, severity, affected_people, priority_score, priority_level, status, is_escalated, escalation_reason, created_at
) VALUES
-- 1. High priority Drainage complaint (Verified & Assigned)
(
    '55555555-5555-5555-5555-555555555501', 'CF-2026-1001',
    'Severely Choked Storm Drain Causing Street Waterlogging',
    'Main storm drain is completely clogged with sediment and plastic waste. Black foul water is spilling over the pedestrian walkway and making shop entrances inaccessible.',
    '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102',
    '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301',
    'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?auto=format&fit=crop&w=800&q=80',
    'high', '50-200', 12.00, 'urgent', 'in_progress', FALSE, NULL, NOW() - INTERVAL '1 day'
),
-- 2. Duplicate of #1 reported nearby (For Duplicate Detection demonstration!)
(
    '55555555-5555-5555-5555-555555555502', 'CF-2026-1002',
    'Overflowing sewer water near market rear exit',
    'Filthy gutter water backing up into the alley behind Central Produce market. Severe stench and pedestrian hazard.',
    '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102',
    '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333301',
    'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?auto=format&fit=crop&w=800&q=80',
    'high', '50-200', 11.50, 'high', 'submitted', FALSE, NULL, NOW() - INTERVAL '4 hours'
),
-- 3. Overdue Electrical complaint (For Escalation Reminder demonstration!)
(
    '55555555-5555-5555-5555-555555555503', 'CF-2026-1003',
    'Dangling Live Cable from Damaged Utility Pole',
    'Heavy winds cracked an electrical utility pole, leaving an insulated wire hanging within reach of pedestrians walking towards the high school.',
    '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111104',
    '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333301',
    'https://images.unsplash.com/photo-1509390144011-8ec2e76d2036?auto=format&fit=crop&w=800&q=80',
    'critical', '200+', 16.50, 'urgent', 'verified', TRUE, 'Exceeded 24-hour critical SLA threshold without departmental dispatch', NOW() - INTERVAL '3 days'
),
-- 4. Deep Pothole on Arterial Road (In Progress)
(
    '55555555-5555-5555-5555-555555555504', 'CF-2026-1004',
    'Deep Crater Pothole on Fast-Moving Transit Lane',
    'Approximately 1.5 ft wide and 6 inches deep crater on the fast lane. Multiple two-wheelers have skidded and damaged rims.',
    '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103',
    '44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333301',
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    'high', '200+', 14.00, 'urgent', 'in_progress', FALSE, NULL, NOW() - INTERVAL '2 days'
),
-- 5. Garbage overflow resolved (Resolved demonstration)
(
    '55555555-5555-5555-5555-555555555505', 'CF-2026-1005',
    'Community Dumpster Overflowing for 4 Days',
    'Garbage bin at the park entrance is overflowing onto the lawn. Stray animals scattering trash over a 30m area.',
    '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101',
    '44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333301',
    'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
    'medium', '50-200', 8.50, 'high', 'resolved', FALSE, NULL, NOW() - INTERVAL '5 days'
)
ON CONFLICT (tracking_number) DO NOTHING;

-- Link duplicate complaint CF-2026-1002 to parent CF-2026-1001
UPDATE complaints 
SET parent_complaint_id = '55555555-5555-5555-5555-555555555501'
WHERE id = '55555555-5555-5555-5555-555555555502';

-- Update parent complaint duplicate count
UPDATE complaints
SET duplicate_count = 1
WHERE id = '55555555-5555-5555-5555-555555555501';

-- Mark resolution timestamp for #5
UPDATE complaints
SET resolved_at = NOW() - INTERVAL '1 day'
WHERE id = '55555555-5555-5555-5555-555555555505';

-- ----------------------------------------------------------------------------
-- SEED DATA: STATUS HISTORY TIMELINE
-- ----------------------------------------------------------------------------
INSERT INTO status_history (complaint_id, changed_by_user_id, old_status, new_status, remarks, created_at) VALUES
('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333301', NULL, 'submitted', 'Complaint submitted via citizen portal with photo', NOW() - INTERVAL '24 hours'),
('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333302', 'submitted', 'verified', 'Verified on ground report. Urgent drainage obstruction confirmed.', NOW() - INTERVAL '20 hours'),
('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333302', 'verified', 'assigned', 'Assigned to Water Supply & Sewerage Board (WSSB)', NOW() - INTERVAL '18 hours'),
('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333305', 'assigned', 'in_progress', 'Drainage suction truck and 4-man crew dispatched to site', NOW() - INTERVAL '6 hours'),

('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333301', NULL, 'submitted', 'Citizen reported overflowing dumpster', NOW() - INTERVAL '5 days'),
('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333302', 'submitted', 'assigned', 'Forwarded to Solid Waste Management', NOW() - INTERVAL '4 days'),
('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333304', 'assigned', 'in_progress', 'Compactor truck en route', NOW() - INTERVAL '2 days'),
('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333304', 'in_progress', 'resolved', 'Bin cleared, area sanitized with lime powder, collection frequency updated.', NOW() - INTERVAL '1 day');
