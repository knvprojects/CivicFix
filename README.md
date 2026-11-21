<<<<<<< HEAD
﻿# 🛠️ CivicFix – Local Infrastructure Complaint Management Platform

> **Make local infrastructure complaints trackable, transparent, and measurable.**

---

## 📌 Executive Summary

**CivicFix** is a clean, modern, lightweight, and fully functional civic engagement and infrastructure complaint platform built to bridge the gap between citizens and municipal maintenance departments.

Citizens frequently encounter infrastructure breakdowns—such as overflowing trash dumpsters, clogged storm sewers causing road waterlogging, dangerous crater potholes on arterial roads, or hanging high-voltage electric wires—without knowing where to report them or whether action has been taken. 

CivicFix solves this by providing:
1. **Citizen Issue Reporting with Manual Location Entry**: Clear, manual entry of locality, ward number, street address, and coordinates (auto-GPS popup removed for privacy and accuracy), along with photographic evidence and detailed descriptions.
2. **AI-Assisted Categorization with Human Confirmation**: Analyzes problem descriptions in real-time or via one-click check, with mandatory human confirmation required before any category is applied.
3. **Geospatial & Textual Duplicate Detection**: Proximity calculations and text token similarity consolidate multi-citizen reports rather than creating fragmented tickets.
4. **Algorithmic Priority Scoring (Severity, Affected People & Report Age)**: Transparent mathematical scoring:
   $$\text{Priority Score} = (\text{Severity Wt} \times 2.5) + (\text{Affected People Wt} \times 1.5) + (\text{Report Age Days} \times 0.5) + (\text{Duplicates} \times 1.0)$$
5. **Departmental Routing & SLA Tracking**: Automated routing across five municipal departments (SWM, WSSB, PWD, CEPD, PUAD).
6. **Automated Escalation Reminders**: Flags overdue issues that breach departmental SLA resolution targets.
7. **Interactive Public GIS Map & Live Dashboard**: Powered by ultra-reliable CartoDB Voyager tiles (avoiding OpenStreetMap 403 access blocked errors on local file/browser URLs), with category pins and recurring hotspot overlays.
8. **Advanced Engineering Challenge**: Historical pattern mining that clusters recurring infrastructure failure hotspots and generates explainable preventive maintenance recommendations for municipal engineers.

---

## 💻 Technology Stack

CivicFix is developed strictly adhering to the specified minimalist, framework-free requirements:

- **HTML5** – Semantic, accessible page structures.
- **CSS3** – Custom spacious responsive design system, modern card layouts, status badges, flexbox/grid, and micro-interactions (Zero Bootstrap or Tailwind bloat).
- **JavaScript (ES6+)** – Modular, readable vanilla JavaScript application logic (Zero React, Angular, Vue, or Node.js runtime required).
- **Leaflet.js & CartoDB Voyager** – Pure client-side interactive mapping with zero proprietary API keys required and zero 403 access blocked errors.
- **Native Browser Geolocation API (
avigator.geolocation)** – Direct, private GPS location retrieval with explicit user permission prompt, comprehensive error handling (denied, unavailable, timeout), and zero expiring API keys.
- **OpenStreetMap Nominatim Reverse Geocoding** – 100% free client-side address & locality resolution without API keys or rate quotas.
- **Supabase / PostgreSQL** – Comprehensive relational database schema with tables, foreign key constraints, priority calculation functions, and synthetic seed datasets.
- **Dual-Engine Persistence** – Seamlessly operates out of the box with zero setup via an intelligent LocalStorage synthetic database engine, while being 100% prepared to connect to a live Supabase PostgreSQL instance by inputting your URL and Anon Key.

---

## 📂 Project Folder Structure

```
CivicFix/
├── index.html                   # Landing page, civic mission, how it works, role quick-switchers
├── login.html                   # User login with 1-click demo role buttons
├── register.html                # Citizen registration form with role choice
├── dashboard.html               # Municipal KPI dashboard, SLA escalations & Advanced Engineering Challenge
├── submit-complaint.html        # Complaint reporting form with AI categorization, duplicate detector & manual location entry
├── complaints.html              # Central complaints directory with multi-factor filters and role queues
├── complaint-details.html       # Individual ticket inspection, priority formula breakdown, audit timeline & actions
├── public-map.html              # Interactive public GIS map with category pins and recurring hotspot overlays
│
├── css/
│   └── style.css                # Master responsive stylesheet (Pure CSS3 with spacious layout & card padding)
│
├── js/
│   ├── supabase.js              # Database adapter layer (dual-mode: Live Supabase + Local Synthetic DB)
│   ├── auth.js                  # Authentication, session persistence, role permissions & fast role switcher
│   ├── complaints.js            # Complaint submission, AI categorization, duplicate detection & priority logic
│   ├── dashboard.js             # KPI aggregation, SLA escalation engine & predictive maintenance analysis
│   └── map.js                   # Leaflet interactive map, custom markers, popups & manual location coordinates
│
├── assets/
│   └── images/
│       └── logo.svg             # Platform vector identity logo
│
├── database/
│   └── schema.sql               # PostgreSQL schema for Supabase (tables, indexes, priority functions & seed data)
│
└── README.md                    # Complete setup, testing, and feature access documentation
```

---

## 🚀 How to Execute and Run the Application Locally

You can run CivicFix immediately on any computer with any modern web browser (Chrome, Edge, Firefox, Safari).

### Method 1: Instant Direct Launch (Simplest - 5 Seconds)
1. Unzip `CivicFix.zip` into any folder.
2. Open the folder and double-click `index.html` (or right-click `index.html` → **Open with** → your preferred web browser).
3. The platform opens immediately with preloaded synthetic civic complaints, interactive maps, duplicate detectors, and role switchers!

### Method 2: Local HTTP Server (Recommended)
Using Python:
```bash
# Navigate into the project folder:
cd CivicFix

# Start a local web server on port 8000:
python -m http.server 8000
```
Then open your browser at:
```
http://localhost:8000
```

---

## 🗄️ Supabase / PostgreSQL Database Configuration

CivicFix is architected to run immediately in **Zero-Config Local Evaluation Mode** using realistic sample data, while supporting seamless connection to a live **Supabase** backend:

### To Connect to Live Supabase:
1. Create a free account at [https://supabase.com](https://supabase.com) and create a new project.
2. In your Supabase Project Dashboard, go to **SQL Editor**.
3. Open the file `database/schema.sql` located inside `CivicFix/database/`.
4. Copy and paste the entire contents into the Supabase SQL Editor and click **Run**.
5. In your Supabase Dashboard, go to **Project Settings** → **API**.
6. Copy your **Project URL** and **anon public Key**.
7. Open `CivicFix/js/supabase.js` and insert your credentials into `CIVICFIX_CONFIG`:
   ```javascript
   const CIVICFIX_CONFIG = {
       SUPABASE_URL: 'https://your-project-id.supabase.co',
       SUPABASE_ANON_KEY: 'your-anon-public-key-here',
       STORAGE_KEY: 'civicfix_database_v1'
   };
   ```

---

## 👥 User Roles & 1-Click Role Switcher

For quick evaluation, **a role-switcher dropdown is built into the top navigation bar of every page**. You can switch roles in one click without logging out:

| Role | Demo User | Email Account | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Citizen** | John Citizen | `citizen@civicfix.org` | Submit complaints, upload photos, get AI suggestions, track personal ticket status |
| **Issue Moderator** | Sarah Jenkins | `moderator@civicfix.org` | Verify ground reports, review duplicate candidate tickets, merge reports, route to departments |
| **Department Rep** | Carlos Mendez (PWD) | `rep.pwd@civicfix.org` | View department queue, update status to `In Progress`, mark `Resolved` with field notes |
| **Administrator** | Eleanor Vance | `admin@civicfix.org` | Platform overview, SLA escalation monitoring, historical recurring hotspot analysis |

*(Password for all demo accounts in login form: `password123`)*

---

## 🌟 How to Access and Test Every Feature

### 1. Manual Location Entry & Complaint Submission
1. Open `submit-complaint.html`.
2. Notice the location fields are **100% manual entry** (no forced GPS auto-detection popups):
   - **Locality / Area Name** (e.g. *Central Market Road*)
   - **Ward / District Number** (e.g. *Ward 4*)
   - **Street Address & Landmark** (e.g. *142 Market Street, near Clock Tower*)
   - **Coordinates** (Editable numbers: e.g. `37.774900`, `-122.419400` with optional pin verification map)
3. Enter title, description, category, severity, and **Number of Affected People**.
4. Select or click a sample photo button (`💧 Drainage`, `🗑️ Garbage`, `🚧 Pothole`, `⚡ Streetlight`, `🌳 Park`).
5. Click **"🚀 Submit Infrastructure Complaint"**.

---

### 2. AI-Assisted Complaint Categorization (with Human Confirmation)
1. On `submit-complaint.html`, enter a description with civic keywords:
   - *"Sewage water overflowing from broken pipe"* ➔ AI predicts **💧 Drainage & Water Logging** (~92% confidence).
   - *"Community dumpster overflowing with rotten garbage"* ➔ AI predicts **🗑️ Garbage & Sanitation** (~94% confidence).
   - *"Deep asphalt crater damaging two-wheeler suspensions"* ➔ AI predicts **🚧 Roads & Potholes** (~95% confidence).
   - *"Electric pole wire snapped and hanging low near school"* ➔ AI predicts **⚡ Streetlights & Electrical** (~96% confidence).
2. You can also click the dedicated **`[🤖 Analyze with AI]`** button at any time.
3. The AI suggestion box appears with the confidence score and detected keywords.
4. **Mandatory Human Confirmation**: The category dropdown does **not** change automatically; you must click **"✓ Accept & Apply Category"** to confirm.

---

### 3. Duplicate Complaint Detection
1. On `submit-complaint.html`, enter the title: *"Sewer overflow backing up behind produce market"*.
2. Keep the location set to **Central Market Road** (`37.7749`, `-122.4194`) and category **Drainage & Water Logging**.
3. A **Duplicate Detection Alert Card** immediately appears above the form:
   - *"⚠️ Potential Duplicate Report Detected Nearby! An existing issue matches your report in this vicinity: #CF-2026-1001"*.
   - Proximity (~120m away) and text similarity score are displayed.
   - Click **"🔗 Link My Report to Existing Issue"** to consolidate your report as a child ticket under the primary issue, which automatically boosts the issue's priority score.

---

### 4. Complaint Priority Management (Affected People & Report Age)
1. The priority engine calculates a numeric score based on four strict factors:
   $$\text{Priority Score} = (\text{Severity Wt} \times 2.5) + (\text{Affected People Wt} \times 1.5) + (\text{Report Age Days} \times 0.5) + (\text{Duplicates} \times 1.0)$$
2. On `submit-complaint.html`, switch severity from **Low** to **Critical**, and affected people from **1-10** to **200+**.
3. Watch the **Dynamic Priority Calculation Card** update in real-time.
4. Open `complaint-details.html` to view the dedicated **"Priority Score & Impact Analysis"** card showing the exact weights for:
   - **Severity Factor**
   - **Number of Affected People**
   - **Report Age** (e.g. *Reported 3 days ago • +1.5 pts age weight*)
   - **Duplicate Reports**
5. On `complaints.html`, view the new **"Impact & Age"** column displaying `👥 50-200` and `⏱️ 3d ago` for every complaint.

---

### 5. Department / Team Routing
1. Complaints are automatically routed based on category:
   - **Garbage & Sanitation** ➔ Solid Waste Management (SWM)
   - **Drainage & Water Logging** ➔ Water Supply & Sewerage Board (WSSB)
   - **Roads & Potholes** ➔ Public Works Department (PWD)
   - **Streetlights & Electrical** ➔ City Electricity & Power Dept (CEPD)
   - **Public Infrastructure** ➔ Parks & Urban Amenities (PUAD)
2. Switch role to **Issue Moderator** or **Administrator** on `complaint-details.html` and click **"🏢 Assign / Route Department"** to re-route tickets.

---

### 6. Complaint Status Tracking & Audit Timeline
1. The platform enforces the 6 complaint lifecycle statuses:
   `Submitted` ➔ `Verified` ➔ `Assigned` ➔ `In Progress` ➔ `Resolved` (or `Rejected`).
2. Open `complaint-details.html`.
3. In the right column, view the **Status History & Audit Trail**, logging every transition with timestamps, actor name, actor role, and remarks.
4. Switch role to **Department Rep** (`rep.pwd@civicfix.org`), enter work notes in the action card, and click **"✓ Mark as Resolved"**.

---

### 7. Escalation Reminders for Overdue Complaints
1. When a ticket exceeds its departmental SLA without resolution, the system flags it as `ESCALATED`.
2. Open `dashboard.html` and scroll to **"⏱️ Escalation Reminders & Overdue Issues"**.
3. View complaint **#CF-2026-1003** (*"Dangling Live Cable from Damaged Utility Pole"*):
   - Displays `⏱️ Report Age: 3 days (72h elapsed) • Breached 24-hour critical SLA threshold`.
   - Click **"🔔 Send Urgent Reminder"** to simulate dispatching high-priority escalation notifications to field crew supervisors.

---

### 8. Public Interactive Map (Working Reliably with Zero 403 Errors)
1. Open `public-map.html`.
2. The map loads reliably using CartoDB Voyager tiles (fixing OpenStreetMap volunteer server 403 access blocked errors).
3. Features:
   - **Custom Category Pins**: Droplets for Drainage, Trash Cans for Garbage, Cones for Potholes, Lightning Bolts for Streetlights.
   - **Pin Popups**: Displays photo thumbnail, status badge, priority tier, affected people count, report age, and a direct link to ticket details.
   - **Recurring Hotspot Shading**: Red/amber circles mark high-density recurring incident zones.
   - **Floating Filters**: Filter pins by category, status (Open vs. Resolved), or toggle hotspot overlays.

---

### 9. Advanced Engineering Challenge: Historical Hotspot Mining & Explainable Preventive Maintenance Engine
1. Open `dashboard.html` and scroll to the blue-bordered section: **"Advanced Engineering Challenge"**.
2. **Cluster Density Analysis**: Identifies failure clusters (e.g., *Ward 4 – Central Market Road* with repeated drainage backflows).
3. **Preventive Maintenance Priority Generator**: Recommends systemic engineering interventions (e.g., *"Comprehensive Hydro-Jetting Desilting & Silt Trap Installation"*).
4. **Explainable AI Factors**: Each recommendation provides five transparent factors:
   - **Recurrence Pattern**: *2 major sewer overflow incidents & 1 duplicate report within 48 hours.*
   - **Estimated Population Impact**: *850 shopkeepers and 4,000+ daily market footfall.*
   - **Root Cause Analysis**: *Plastic bag agglomeration combining with kitchen waste fat, narrowing pipe diameter by ~70%.*
   - **Seasonal/Weather Vulnerability**: *Pre-monsoon season approaching in 3 weeks; high risk of multi-block flooding.*
   - **Cost-Benefit ROI**: *Preventive desilting cost ($1,800) prevents an estimated $32,000 in commercial road damage and business closure downtime.*

=======
# CivicFix
>>>>>>> 4b991978836a5d16be7cfdf09097104f384a6300
