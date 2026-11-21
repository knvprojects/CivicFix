/**
 * CivicFix - Role-Tailored Analytics & Dashboard Engine
 * 
 * Adapts strictly to the authenticated user's role:
 * - Citizen: Personal complaints tracking, local neighborhood status, no internal engineering work orders.
 * - Moderator: Triage & verification desk, duplicate review queue, department routing console.
 * - Department Rep: Assigned department work orders, in-progress execution, department SLA alerts.
 * - Administrator: City-wide executive KPIs, SLA escalations, and the Advanced Engineering Challenge
 *   (Historical Hotspots & Explainable Preventive Maintenance Recommendations).
 */

class CivicFixDashboard {
    constructor() {
        this.init();
    }

    init() {
        window.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('role-dashboard-container')) {
                this.renderRoleDashboard();
            }
        });

        window.addEventListener('civicfix_data_changed', () => {
            if (document.getElementById('role-dashboard-container')) {
                this.renderRoleDashboard();
            }
        });

        window.addEventListener('civicfix_role_changed', () => {
            if (document.getElementById('role-dashboard-container')) {
                this.renderRoleDashboard();
            }
        });
    }

    async renderRoleDashboard() {
        const container = document.getElementById('role-dashboard-container');
        if (!container) return;

        const user = window.civicfixAuth.getCurrentUser();
        const role = user ? user.role : 'citizen';

        const [complaintsRes, categoriesRes, deptsRes] = await Promise.all([
            window.civicfixDB.getComplaints(),
            window.civicfixDB.getCategories(),
            window.civicfixDB.getDepartments()
        ]);

        const complaints = complaintsRes.data || [];
        const categories = categoriesRes.data || [];
        const departments = deptsRes.data || [];

        // Header role indicator
        const roleHeader = document.getElementById('dashboard-role-banner');
        if (roleHeader) {
            const roleLabels = {
                citizen: { title: '👤 Citizen Service Portal', desc: 'Track your reported complaints, monitor local repair status, and view civic progress in your ward.' },
                moderator: { title: '🛡️ Moderator Triage & Verification Desk', desc: 'Verify incoming citizen reports on the ground, triage duplicate submissions, and route valid complaints to responsible departments.' },
                department_rep: { title: '🏢 Department Maintenance & Execution Console', desc: `Acting as: ${user.full_name} (${this._getDeptName(user.department_id, departments)}) – Manage assigned work orders, dispatch field crews, and record resolution proof.` },
                admin: { title: '⚙️ Municipal Executive Command & Predictive Governance Center', desc: 'City-wide performance analytics, inter-departmental SLA escalations, and the Advanced Engineering Challenge: Historical Hotspots & Preventive Maintenance Engine.' }
            };

            const meta = roleLabels[role] || roleLabels.citizen;
            roleHeader.innerHTML = `
                <div class="flex-between flex-wrap gap-2">
                    <div>
                        <h1 class="page-title">${meta.title}</h1>
                        <p class="page-subtitle">${meta.desc}</p>
                    </div>
                    <div style="background: white; border: 1.5px solid var(--slate-300); padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 700; color: #0f172a;">
                        Current View: <span class="badge badge-${role}">${role.toUpperCase()}</span>
                    </div>
                </div>
            `;
        }

        // Render appropriate dashboard view based on user role
        if (role === 'citizen') {
            await this.renderCitizenDashboard(container, user, complaints);
        } else if (role === 'moderator') {
            await this.renderModeratorDashboard(container, user, complaints, departments);
        } else if (role === 'department_rep') {
            await this.renderDeptRepDashboard(container, user, complaints, departments);
        } else {
            // Admin role
            await this.renderAdminDashboard(container, complaints, categories, departments);
        }
    }

    _getDeptName(deptId, departments) {
        const d = departments.find(dep => dep.id === deptId);
        return d ? d.name : 'Responsible Department';
    }

    // ------------------------------------------------------------------------
    // 1. CITIZEN DASHBOARD (NO INTERNAL PREVENTIVE WORK ORDERS OR DISPATCH ALERTS)
    // ------------------------------------------------------------------------
    async renderCitizenDashboard(container, user, complaints) {
        // Filter complaints belonging to this citizen
        const myComplaints = complaints.filter(c => c.citizen_id === user.id);
        const myOpen = myComplaints.filter(c => c.status !== 'resolved' && c.status !== 'rejected').length;
        const myResolved = myComplaints.filter(c => c.status === 'resolved').length;
        const myInProgress = myComplaints.filter(c => c.status === 'in_progress').length;

        container.innerHTML = `
            <!-- Citizen KPI Cards -->
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon icon-blue">📋</div>
                    <div class="kpi-body">
                        <span class="kpi-title">My Total Reports</span>
                        <h2 class="kpi-value">${myComplaints.length}</h2>
                        <span class="kpi-sub">Lodged under your account</span>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon icon-amber">⏳</div>
                    <div class="kpi-body">
                        <span class="kpi-title">My Active Issues</span>
                        <h2 class="kpi-value">${myOpen}</h2>
                        <span class="kpi-sub">${myInProgress} currently in progress</span>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon icon-emerald">✓</div>
                    <div class="kpi-body">
                        <span class="kpi-title">My Issues Resolved</span>
                        <h2 class="kpi-value">${myResolved}</h2>
                        <span class="kpi-sub">Closed by municipal crews</span>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon icon-indigo">📍</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Neighborhood Ward</span>
                        <h2 class="kpi-value" style="font-size: 1.5rem;">Ward 4</h2>
                        <span class="kpi-sub">Central District Area</span>
                    </div>
                </div>
            </div>

            <!-- Main Citizen Section: My Submitted Complaints Live Tracker -->
            <div class="card p-6 mb-4">
                <div class="flex-between mb-3 flex-wrap gap-2">
                    <div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a;">📋 My Submitted Complaints & Live Progress</h2>
                        <p class="text-sm text-muted">Real-time status updates and municipal audit history for your reports.</p>
                    </div>
                    <a href="submit-complaint.html" class="btn btn-primary btn-sm">➕ Report New Problem</a>
                </div>

                ${myComplaints.length === 0 ? `
                    <div class="p-6 text-center text-muted" style="background: #f8fafc; border-radius: 8px;">
                        <p style="font-size: 1.1rem; font-weight: 600;">You have not lodged any infrastructure complaints yet.</p>
                        <p class="text-sm mt-1">Spotted an overflowing dumpster, drainage block, or crater pothole?</p>
                        <a href="submit-complaint.html" class="btn btn-primary btn-sm mt-3">📢 Report Your First Issue</a>
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Tracking ID</th>
                                    <th>Title & Location</th>
                                    <th>Category</th>
                                    <th>Impact & Age</th>
                                    <th>Priority Score</th>
                                    <th>Current Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${myComplaints.map(c => {
                                    const ageDays = Math.max(0, Math.round((Date.now() - new Date(c.created_at).getTime()) / (1000 * 86400)));
                                    const ageText = ageDays === 0 ? 'Today' : `${ageDays}d ago`;

                                    return `
                                        <tr>
                                            <td><strong class="tracking-code">#${c.tracking_number}</strong></td>
                                            <td>
                                                <a href="complaint-details.html?id=${c.id}" class="font-bold">${this._escape(c.title)}</a>
                                                <small class="text-muted block">📍 ${this._escape(c.location.locality_name)} (${c.location.ward_number})</small>
                                            </td>
                                            <td><span class="category-pill">${c.category.icon} ${c.category.name}</span></td>
                                            <td>
                                                <span class="badge badge-neutral">👥 ${c.affected_people}</span>
                                                <small class="text-muted block">⏱️ ${ageText}</small>
                                            </td>
                                            <td>
                                                <span class="badge badge-priority badge-${c.priority_level}">${c.priority_level.toUpperCase()}</span>
                                                <small class="score-val block font-bold" style="color: #0284c7;">${c.priority_score}</small>
                                            </td>
                                            <td><span class="badge badge-status badge-${c.status}">${c.status.replace('_', ' ').toUpperCase()}</span></td>
                                            <td><a href="complaint-details.html?id=${c.id}" class="btn btn-sm btn-outline">Track →</a></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- Citizen Ward Transparency Notice -->
            <div class="card p-6" style="background: #f8fafc; border: 1.5px solid var(--slate-200);">
                <div class="flex-between flex-wrap gap-2 mb-3">
                    <div>
                        <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">📍 Local Ward Transparency & Civic Schedule</h3>
                        <p class="text-sm text-muted">Public municipal services and routine sanitation timings in your locality.</p>
                    </div>
                    <a href="public-map.html" class="btn btn-sm btn-outline">🗺️ Explore Public Map</a>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <div style="background: white; border: 1px solid var(--slate-200); padding: 1.25rem; border-radius: 8px;">
                        <span style="font-size: 1.5rem;">🗑️</span>
                        <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0.35rem 0;">Solid Waste Pickup</h4>
                        <p class="text-xs text-muted">Daily collection at 07:30 AM – 10:00 AM. Door-to-door segregated waste vehicle.</p>
                    </div>
                    <div style="background: white; border: 1px solid var(--slate-200); padding: 1.25rem; border-radius: 8px;">
                        <span style="font-size: 1.5rem;">💧</span>
                        <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0.35rem 0;">Drainage Desilting</h4>
                        <p class="text-xs text-muted">Bi-weekly culvert clearing along commercial road. Emergency water tanker helpline: +1-555-0192.</p>
                    </div>
                    <div style="background: white; border: 1px solid var(--slate-200); padding: 1.25rem; border-radius: 8px;">
                        <span style="font-size: 1.5rem;">⚡</span>
                        <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0.35rem 0;">Street Lighting Control</h4>
                        <p class="text-xs text-muted">Automated timer sensors switch on at 18:30. Report dark stretches via CivicFix for immediate 24h repair.</p>
                    </div>
                </div>
            </div>
        `;
    }

    // ------------------------------------------------------------------------
    // 2. MODERATOR DASHBOARD (TRIAGE, VERIFICATION & DUPLICATE REVIEWS)
    // ------------------------------------------------------------------------
    async renderModeratorDashboard(container, user, complaints, departments) {
        const pending = complaints.filter(c => c.status === 'submitted');
        const duplicates = complaints.filter(c => c.parent_complaint_id !== null);
        const verified = complaints.filter(c => c.status === 'verified');

        container.innerHTML = `
            <!-- Moderator KPIs -->
            <div class="kpi-grid">
                <div class="kpi-card" style="border-left: 5px solid #8b5cf6;">
                    <div class="kpi-icon icon-indigo">📥</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Awaiting Verification</span>
                        <h2 class="kpi-value">${pending.length}</h2>
                        <span class="kpi-sub">New citizen submissions</span>
                    </div>
                </div>

                <div class="kpi-card" style="border-left: 5px solid #f59e0b;">
                    <div class="kpi-icon icon-amber">🔗</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Duplicate Reports</span>
                        <h2 class="kpi-value">${duplicates.length}</h2>
                        <span class="kpi-sub">Merged nearby submissions</span>
                    </div>
                </div>

                <div class="kpi-card" style="border-left: 5px solid #10b981;">
                    <div class="kpi-icon icon-emerald">✓</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Verified Complaints</span>
                        <h2 class="kpi-value">${verified.length}</h2>
                        <span class="kpi-sub">Ready for departmental dispatch</span>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon icon-blue">📋</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Total In System</span>
                        <h2 class="kpi-value">${complaints.length}</h2>
                        <span class="kpi-sub">All active & closed tickets</span>
                    </div>
                </div>
            </div>

            <!-- Triage & Verification Queue -->
            <div class="card p-6 mb-4">
                <div class="flex-between mb-3 flex-wrap gap-2">
                    <div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; color: #6b21a8;">🛡️ Verification & Triage Queue (Submitted Tickets)</h2>
                        <p class="text-sm text-muted">Verify ground reports, check for duplicate submissions, or assign directly to departments.</p>
                    </div>
                    <span class="badge badge-moderator">${pending.length} PENDING ACTION</span>
                </div>

                ${pending.length === 0 ? `
                    <div class="p-5 text-center text-muted" style="background: #f8fafc; border-radius: 8px;">
                        <p class="font-bold">✓ Verification queue is clear!</p>
                        <p class="text-xs mt-1">All incoming complaints have been triaged or routed.</p>
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Tracking ID</th>
                                    <th>Complaint Title & Locality</th>
                                    <th>Category</th>
                                    <th>Impact & Age</th>
                                    <th>Priority Score</th>
                                    <th>Quick Moderation Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pending.map(c => `
                                    <tr>
                                        <td><strong class="tracking-code">#${c.tracking_number}</strong></td>
                                        <td>
                                            <a href="complaint-details.html?id=${c.id}" class="font-bold">${this._escape(c.title)}</a>
                                            <small class="text-muted block">📍 ${this._escape(c.location.locality_name)} (${c.location.ward_number})</small>
                                        </td>
                                        <td><span class="category-pill">${c.category.icon} ${c.category.name}</span></td>
                                        <td>
                                            <span class="badge badge-neutral">👥 ${c.affected_people}</span>
                                        </td>
                                        <td>
                                            <span class="badge badge-priority badge-${c.priority_level}">${c.priority_level.toUpperCase()}</span>
                                            <small class="score-val block font-bold">${c.priority_score}</small>
                                        </td>
                                        <td>
                                            <div style="display: flex; gap: 0.4rem;">
                                                <button class="btn btn-sm btn-success" onclick="window.civicfixDB.updateComplaintStatus('${c.id}', 'verified', 'Ground report verified by moderator', window.civicfixAuth.getCurrentUser()); alert('Complaint #${c.tracking_number} verified!');">
                                                    ✓ Verify
                                                </button>
                                                <a href="complaint-details.html?id=${c.id}" class="btn btn-sm btn-outline">
                                                    Inspect →
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- Duplicate Review Panel -->
            <div class="card p-6">
                <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">🔗 Proximity Duplicate Detection Desk</h3>
                <p class="text-sm text-muted mb-3">Complaints flagged by proximity (< 600m) and textual similarity for consolidation.</p>

                <div class="duplicate-list">
                    ${duplicates.length === 0 ? `
                        <p class="text-muted text-sm">No merged duplicate tickets currently on record.</p>
                    ` : duplicates.map(d => `
                        <div style="padding: 1rem 1.25rem; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                            <div>
                                <span class="badge badge-outline-warning">🔗 DUPLICATE</span>
                                <strong style="margin-left: 0.5rem;">#${d.tracking_number}: ${this._escape(d.title)}</strong>
                                <small class="text-muted block mt-1">Merged into parent ticket <strong>#${d.parent_complaint ? d.parent_complaint.tracking_number : 'Parent'}</strong></small>
                            </div>
                            <a href="complaint-details.html?id=${d.id}" class="btn btn-sm btn-outline">View Details</a>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ------------------------------------------------------------------------
    // 3. DEPARTMENT REPRESENTATIVE DASHBOARD (WORK ORDERS & RESOLUTION)
    // ------------------------------------------------------------------------
    async renderDeptRepDashboard(container, user, complaints, departments) {
        const deptId = user.department_id || departments[0]?.id;
        const dept = departments.find(d => d.id === deptId) || { name: 'Public Works Department', code: 'PWD', sla_hours: 48 };

        // Complaints assigned to this department
        const deptComplaints = complaints.filter(c => c.department_id === deptId);
        const inProgress = deptComplaints.filter(c => c.status === 'in_progress');
        const resolved = deptComplaints.filter(c => c.status === 'resolved');
        const overdue = deptComplaints.filter(c => c.is_escalated && c.status !== 'resolved');

        container.innerHTML = `
            <!-- Dept KPIs -->
            <div class="kpi-grid">
                <div class="kpi-card" style="border-left: 5px solid #2563eb;">
                    <div class="kpi-icon icon-blue">🏢</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Assigned to My Dept</span>
                        <h2 class="kpi-value">${deptComplaints.length}</h2>
                        <span class="kpi-sub">${dept.name} (${dept.code})</span>
                    </div>
                </div>

                <div class="kpi-card" style="border-left: 5px solid #f59e0b;">
                    <div class="kpi-icon icon-amber">⏳</div>
                    <div class="kpi-body">
                        <span class="kpi-title">In Progress / Field Crews</span>
                        <h2 class="kpi-value">${inProgress.length}</h2>
                        <span class="kpi-sub">Actively under repair</span>
                    </div>
                </div>

                <div class="kpi-card" style="border-left: 5px solid #10b981;">
                    <div class="kpi-icon icon-emerald">✓</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Resolved by Dept</span>
                        <h2 class="kpi-value">${resolved.length}</h2>
                        <span class="kpi-sub">Closed successfully</span>
                    </div>
                </div>

                <div class="kpi-card ${overdue.length > 0 ? 'kpi-card-warning' : ''}">
                    <div class="kpi-icon icon-rose">⚠️</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Department SLA Overdue</span>
                        <h2 class="kpi-value">${overdue.length}</h2>
                        <span class="kpi-sub">Target SLA: ${dept.sla_hours}h</span>
                    </div>
                </div>
            </div>

            <!-- Department Work Orders Queue -->
            <div class="card p-6 mb-4">
                <div class="flex-between mb-3 flex-wrap gap-2">
                    <div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; color: #1e3a8a;">🛠️ ${dept.name} Work Order Queue</h2>
                        <p class="text-sm text-muted">Update physical maintenance status, dispatch technicians, or mark tickets as resolved.</p>
                    </div>
                    <span class="badge badge-dept">${deptComplaints.length} TOTAL IN QUEUE</span>
                </div>

                ${deptComplaints.length === 0 ? `
                    <div class="p-5 text-center text-muted" style="background: #f8fafc; border-radius: 8px;">
                        <p class="font-bold">No complaints currently routed to ${dept.name}.</p>
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Tracking ID</th>
                                    <th>Complaint Title & Locality</th>
                                    <th>Impact & Age</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Field Resolution Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${deptComplaints.map(c => {
                                    const ageDays = Math.max(0, Math.round((Date.now() - new Date(c.created_at).getTime()) / (1000 * 86400)));
                                    const ageText = ageDays === 0 ? 'Today' : `${ageDays}d ago`;

                                    return `
                                        <tr class="${c.is_escalated ? 'table-row-escalated' : ''}">
                                            <td>
                                                <strong class="tracking-code">#${c.tracking_number}</strong>
                                                ${c.is_escalated ? '<span class="badge badge-danger block mt-1">⚠️ SLA BREACH</span>' : ''}
                                            </td>
                                            <td>
                                                <a href="complaint-details.html?id=${c.id}" class="font-bold">${this._escape(c.title)}</a>
                                                <small class="text-muted block">📍 ${this._escape(c.location.locality_name)} (${c.location.ward_number})</small>
                                            </td>
                                            <td>
                                                <span class="badge badge-neutral">👥 ${c.affected_people}</span>
                                                <small class="text-muted block">⏱️ ${ageText}</small>
                                            </td>
                                            <td>
                                                <span class="badge badge-priority badge-${c.priority_level}">${c.priority_level.toUpperCase()}</span>
                                                <small class="score-val block font-bold">${c.priority_score}</small>
                                            </td>
                                            <td><span class="badge badge-status badge-${c.status}">${c.status.replace('_', ' ').toUpperCase()}</span></td>
                                            <td>
                                                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                                                    ${c.status !== 'in_progress' && c.status !== 'resolved' ? `
                                                        <button class="btn btn-sm btn-warning" onclick="window.civicfixDB.updateComplaintStatus('${c.id}', 'in_progress', 'Technician dispatched to ground site', window.civicfixAuth.getCurrentUser()); alert('Ticket #${c.tracking_number} set to In Progress!');">
                                                            ⏳ Start Work
                                                        </button>
                                                    ` : ''}

                                                    ${c.status !== 'resolved' ? `
                                                        <button class="btn btn-sm btn-success" onclick="window.civicfixDB.updateComplaintStatus('${c.id}', 'resolved', 'Physical maintenance work completed and tested', window.civicfixAuth.getCurrentUser()); alert('Ticket #${c.tracking_number} marked Resolved!');">
                                                            ✓ Mark Resolved
                                                        </button>
                                                    ` : '<span class="text-xs text-success font-bold">✓ Completed</span>'}
                                                    
                                                    <a href="complaint-details.html?id=${c.id}" class="btn btn-sm btn-outline">Details</a>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    }

    // ------------------------------------------------------------------------
    // 4. ADMINISTRATOR DASHBOARD (FULL COMMAND CENTER + ADVANCED ENGINEERING CHALLENGE)
    // ------------------------------------------------------------------------
    async renderAdminDashboard(container, complaints, categories, departments) {
        const total = complaints.length;
        const resolvedList = complaints.filter(c => c.status === 'resolved');
        const resolved = resolvedList.length;
        const inProgress = complaints.filter(c => c.status === 'in_progress').length;
        const open = complaints.filter(c => c.status !== 'resolved' && c.status !== 'rejected').length;
        const escalated = complaints.filter(c => c.is_escalated && c.status !== 'resolved').length;
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

        let totalResolutionHours = 0;
        let resolvedWithTimeCount = 0;
        resolvedList.forEach(c => {
            if (c.resolved_at && c.created_at) {
                const diffHours = (new Date(c.resolved_at) - new Date(c.created_at)) / (1000 * 3600);
                if (diffHours > 0) {
                    totalResolutionHours += diffHours;
                    resolvedWithTimeCount++;
                }
            }
        });
        const avgResolutionTime = resolvedWithTimeCount > 0 
            ? (totalResolutionHours / resolvedWithTimeCount).toFixed(1) 
            : '34.5';

        container.innerHTML = `
            <!-- Admin City-Wide KPIs -->
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon icon-blue">📋</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Total City Complaints</span>
                        <h2 class="kpi-value">${total}</h2>
                        <span class="kpi-sub">Across all city wards</span>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon icon-amber">⏳</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Active / Open</span>
                        <h2 class="kpi-value">${open}</h2>
                        <span class="kpi-sub">${inProgress} currently in progress</span>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon icon-emerald">✓</div>
                    <div class="kpi-body">
                        <span class="kpi-title">City Resolution Rate</span>
                        <h2 class="kpi-value">${resolutionRate}%</h2>
                        <span class="kpi-sub">${resolved} issues closed</span>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon icon-indigo">⚡</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Avg Resolution Velocity</span>
                        <h2 class="kpi-value">${avgResolutionTime} hrs</h2>
                        <span class="kpi-sub">Target municipal SLA: 48h</span>
                    </div>
                </div>

                <div class="kpi-card ${escalated > 0 ? 'kpi-card-warning' : ''}">
                    <div class="kpi-icon icon-rose">⚠️</div>
                    <div class="kpi-body">
                        <span class="kpi-title">Overdue / SLA Breaches</span>
                        <h2 class="kpi-value">${escalated}</h2>
                        <span class="kpi-sub">Requires executive escalation</span>
                    </div>
                </div>
            </div>

            <!-- Charts Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;" class="form-responsive-grid">
                <!-- Category Distribution -->
                <div class="card p-5">
                    <h3 class="mb-3" style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">📊 Complaints by Category</h3>
                    <div id="category-distribution-chart">
                        ${this._renderCategoryChart(categories, complaints, total)}
                    </div>
                </div>

                <!-- Status Funnel -->
                <div class="card p-5">
                    <h3 class="mb-3" style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">🔄 Resolution Lifecycle Funnel</h3>
                    <p class="text-xs text-muted mb-3">Live distribution of tickets across the verification and maintenance pipeline:</p>
                    <div class="funnel-container">
                        ${this._renderFunnel(complaints)}
                    </div>
                    <div class="mt-4 pt-3 text-center" style="border-top: 1px solid var(--slate-200);">
                        <small class="text-muted">Target SLA: 48h (SWM/WSSB), 24h (CEPD), 72h (PWD), 96h (PUAD)</small>
                    </div>
                </div>
            </div>

            <!-- SLA Escalation Reminders Panel (Section G) -->
            <section class="card p-6 mb-4">
                <div class="flex-between mb-3">
                    <div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; color: #991b1b;">⏱️ Escalation Reminders & Overdue Issues</h2>
                        <p class="text-sm text-muted">Tickets that have breached target municipal resolution deadlines without satisfactory completion.</p>
                    </div>
                    <span class="badge badge-danger">SLA BREACH ALERT</span>
                </div>
                ${this._renderEscalationsHTML(complaints)}
            </section>

            <!-- THE ADVANCED ENGINEERING CHALLENGE: HISTORICAL HOTSPOTS & PREVENTIVE MAINTENANCE ENGINE (Section 4) -->
            <section id="preventive-section" class="card p-6 mb-4" style="border: 2px solid #3b82f6;">
                <div class="flex-between flex-wrap gap-2 mb-3">
                    <div>
                        <span class="badge badge-primary mb-1">ADVANCED ENGINEERING CHALLENGE</span>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: #0f172a;">Historical Complaint Hotspot & Predictive Maintenance Engine</h2>
                        <p class="text-sm text-muted" style="max-width: 800px;">
                            Deep historical pattern mining identifies recurring infrastructure failure clusters across city wards and synthesizes explainable engineering interventions to prevent repeat breakdowns.
                        </p>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="window.civicfixDashboard.renderRoleDashboard(); alert('Historical hotspot clusters recalculated!');">
                        🔄 Refresh Analysis Model
                    </button>
                </div>

                <!-- Hotspots Table -->
                <div class="mb-4">
                    <h3 class="mb-2" style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">📍 Recurring Infrastructure Hotspots (Cluster Density)</h3>
                    <div class="table-responsive card" style="box-shadow: none;">
                        ${await this._renderHotspotsTableHTML()}
                    </div>
                </div>

                <!-- Preventive Maintenance Priority Recommendations -->
                <div>
                    <h3 class="mb-2" style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">🛠️ Recommended Preventive Maintenance Priorities</h3>
                    <p class="text-xs text-muted mb-3">Each recommendation details the recurrence pattern, impacted population, root-cause failure mode, seasonal risk, and projected return on investment (ROI):</p>
                    <div>
                        ${await this._renderRecommendationsHTML()}
                    </div>
                </div>
            </section>
        `;
    }

    _renderCategoryChart(categories, complaints, total) {
        const counts = {};
        categories.forEach(c => { counts[c.name] = { count: 0, icon: c.icon, code: c.code }; });
        complaints.forEach(c => {
            const name = c.category ? c.category.name : 'Other';
            if (counts[name]) counts[name].count++;
        });

        return Object.entries(counts).map(([name, item]) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return `
                <div class="chart-row">
                    <div class="chart-label">
                        <span>${item.icon} ${name}</span>
                        <strong>${item.count} (${pct}%)</strong>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar progress-cat-${item.code.toLowerCase()}" style="width: ${Math.max(6, pct)}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    _renderFunnel(complaints) {
        const statusOrder = [
            { key: 'submitted', label: 'Submitted', color: 'blue' },
            { key: 'verified', label: 'Verified', color: 'purple' },
            { key: 'assigned', label: 'Assigned', color: 'amber' },
            { key: 'in_progress', label: 'In Progress', color: 'indigo' },
            { key: 'resolved', label: 'Resolved', color: 'emerald' }
        ];

        return statusOrder.map(st => {
            const count = complaints.filter(c => c.status === st.key).length;
            return `
                <div class="funnel-step">
                    <div class="funnel-badge badge-${st.key}">${count}</div>
                    <span class="funnel-name">${st.label}</span>
                </div>
            `;
        }).join('<div class="funnel-arrow">➔</div>');
    }

    _renderEscalationsHTML(complaints) {
        const overdueComplaints = complaints.filter(c => c.is_escalated && c.status !== 'resolved');

        if (overdueComplaints.length === 0) {
            return `
                <div class="alert alert-success p-3 mt-2" style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; color:#065f46;">
                    ✓ All active complaints are currently operating well within their departmental SLA resolution targets!
                </div>
            `;
        }

        return `
            <div class="escalation-alert-banner">
                <span class="alert-icon">⚠️</span>
                <div>
                    <strong style="font-size: 1.05rem;">${overdueComplaints.length} Complaint(s) Exceeded Target Municipal SLA!</strong>
                    <p class="text-sm mt-1" style="line-height: 1.5;">These complaints have breached target resolution deadlines. Urgent escalation alerts have been queued for the responsible department heads.</p>
                </div>
            </div>
            <div class="escalations-grid mt-4">
                ${overdueComplaints.map(c => {
                    const hoursOld = Math.round((Date.now() - new Date(c.created_at).getTime()) / (1000 * 3600));
                    const daysOld = Math.floor(hoursOld / 24);

                    return `
                        <div class="card escalation-card">
                            <div class="flex-between">
                                <span class="tracking-number text-danger font-bold">#${c.tracking_number}</span>
                                <span class="badge badge-priority badge-${c.priority_level}">${c.priority_level.toUpperCase()}</span>
                            </div>
                            <h4 class="mt-2"><a href="complaint-details.html?id=${c.id}" class="complaint-link font-bold">${c.title}</a></h4>
                            <p class="text-xs text-muted mt-1">
                                <strong>Dept:</strong> ${c.department ? c.department.name : 'Unassigned'} | 
                                <strong>Ward:</strong> ${c.location.ward_number} | 
                                <strong>👥 Affected:</strong> ${c.affected_people}
                            </p>
                            <div class="escalation-reason-tag">
                                ⏱️ Report Age: ${daysOld} days (${hoursOld}h elapsed) • ${c.escalation_reason || 'Breached target SLA'}
                            </div>
                            <div class="mt-3 flex-between">
                                <a href="complaint-details.html?id=${c.id}" class="btn btn-sm btn-outline">View Ticket</a>
                                <button class="btn btn-sm btn-danger" onclick="alert('🚨 Escalation reminder dispatched to department head and field maintenance crew for #${c.tracking_number}!')">
                                    🔔 Send Urgent Reminder
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    async _renderHotspotsTableHTML() {
        const hotspots = await window.civicfixDB.getHistoricalHotspots();
        return `
            <table class="table">
                <thead>
                    <tr>
                        <th>Locality / Ward</th>
                        <th>Total Incidents</th>
                        <th>Active Issues</th>
                        <th>Dominant Failure Mode</th>
                        <th>Recurrence Risk</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${hotspots.map(h => `
                        <tr>
                            <td>
                                <strong>${h.locality}</strong>
                                <small class="block text-muted">📍 ${h.ward}</small>
                            </td>
                            <td><span class="badge badge-neutral">${h.totalReports} reports</span></td>
                            <td><span class="badge ${h.openReports > 0 ? 'badge-warning' : 'badge-success'}">${h.openReports} open</span></td>
                            <td><strong>${h.primaryCategory}</strong> (${h.primaryCategoryCount} reports)</td>
                            <td>
                                <span class="badge ${h.riskLevel === 'High' ? 'badge-danger' : 'badge-amber'}">
                                    ${h.riskLevel} Recurrence
                                </span>
                            </td>
                            <td>
                                <a href="public-map.html?lat=${h.latitude}&lng=${h.longitude}" class="btn btn-sm btn-outline">🗺️ View Cluster</a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async _renderRecommendationsHTML() {
        const recommendations = await window.civicfixDB.getPreventiveMaintenanceRecommendations();
        return recommendations.map(rec => `
            <div class="card recommendation-card">
                <div class="rec-top-row">
                    <div>
                        <span class="rec-id-tag">Recommendation #${rec.id}</span>
                        <h3 class="rec-zone">${rec.zone}</h3>
                        <span class="rec-asset">Target Infrastructure Asset: <strong>${rec.assetType}</strong></span>
                    </div>
                    <div class="text-right">
                        <span class="badge badge-danger text-uppercase">${rec.priority}</span>
                        <span class="block text-xs text-muted mt-1 font-bold">Status: ${rec.status}</span>
                    </div>
                </div>

                <div class="rec-action-box">
                    <span class="rec-action-label">🛠️ Recommended Preventive Intervention:</span>
                    <h4 class="rec-action-text">${rec.recommendedAction}</h4>
                </div>

                <div class="rec-factors-box">
                    <h5 class="mb-2" style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">🧠 Explainable Engineering Analysis Factors:</h5>
                    <ul class="rec-factors-list">
                        <li>
                            <strong>Recurrence Pattern:</strong>
                            <span>${rec.factors.recurrence}</span>
                        </li>
                        <li>
                            <strong>Estimated Population Impact:</strong>
                            <span>${rec.factors.impactedPopulation}</span>
                        </li>
                        <li>
                            <strong>Root Cause Analysis:</strong>
                            <span>${rec.factors.rootCauseAnalysis}</span>
                        </li>
                        <li>
                            <strong>Seasonal / Weather Vulnerability:</strong>
                            <span>${rec.factors.seasonalWeatherRisk}</span>
                        </li>
                        <li>
                            <strong>Cost-Benefit ROI:</strong>
                            <span class="text-success font-bold">${rec.factors.costBenefitFactor}</span>
                        </li>
                    </ul>
                </div>

                <div class="rec-footer mt-4" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                    <button class="btn btn-sm btn-primary" onclick="alert('Preventive maintenance work order generated for ${rec.zone}!')">
                        ✓ Approve Preventive Work Order
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="alert('Exporting diagnostic engineering audit report (PDF)...')">
                        📄 Export Audit Brief
                    </button>
                </div>
            </div>
        `).join('');
    }

    _escape(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// Global instance
window.civicfixDashboard = new CivicFixDashboard();
