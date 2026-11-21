/**
 * CivicFix - Authentication & Role Management
 * Handles login, registration, session management, and quick role switching for testing.
 */

const AUTH_STORAGE_KEY = 'civicfix_active_user';

class CivicFixAuth {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
            } catch (e) {
                this.currentUser = null;
            }
        }

        // If no user is logged in, default to Citizen for seamless first-time experience
        if (!this.currentUser) {
            this.switchRole('citizen');
        }

        // Hook up global navigation UI rendering
        window.addEventListener('DOMContentLoaded', () => {
            this.renderNavUserWidget();
        });
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async login(email) {
        const db = window.civicfixDB.getLocalDB();
        const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (user) {
            this.currentUser = user;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
            return { success: true, user };
        } else {
            return { success: false, error: 'User not found. Try one of the demo accounts or register.' };
        }
    }

    async register(name, email, phone, role = 'citizen', departmentId = null) {
        const db = window.civicfixDB.getLocalDB();
        
        const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
            return { success: false, error: 'Email already registered.' };
        }

        const newUser = {
            id: 'u_' + Date.now(),
            email,
            full_name: name,
            phone: phone || '+1-555-0199',
            role,
            department_id: departmentId,
            created_at: new Date().toISOString()
        };

        db.users.push(newUser);
        window.civicfixDB.saveLocalDB(db);

        this.currentUser = newUser;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        return { success: true, user: newUser };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        window.location.href = 'login.html';
    }

    /**
     * Switch role instantly for easy testing and evaluation of all 4 roles
     */
    switchRole(roleName) {
        const db = window.civicfixDB.getLocalDB();
        if (!db || !db.users) return;

        let target = db.users.find(u => u.role === roleName);
        if (!target) {
            target = db.users[0];
        }

        this.currentUser = target;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(target));
        this.renderNavUserWidget();
        
        // Dispatch event so active page updates immediately
        window.dispatchEvent(new CustomEvent('civicfix_role_changed', { detail: target }));
    }

    renderNavUserWidget() {
        const container = document.getElementById('nav-user-widget');
        if (!container) return;

        if (!this.currentUser) {
            container.innerHTML = `
                <a href="login.html" class="btn btn-outline btn-sm">Log In</a>
                <a href="register.html" class="btn btn-primary btn-sm">Register</a>
            `;
            return;
        }

        const roleLabels = {
            citizen: { label: 'Citizen', badgeClass: 'badge-citizen', icon: '👤' },
            moderator: { label: 'Moderator', badgeClass: 'badge-moderator', icon: '🛡️' },
            department_rep: { label: 'Dept Rep', badgeClass: 'badge-dept', icon: '🏢' },
            admin: { label: 'Administrator', badgeClass: 'badge-admin', icon: '⚙️' }
        };

        const currentMeta = roleLabels[this.currentUser.role] || { label: this.currentUser.role, badgeClass: 'badge-default', icon: '👤' };

        container.innerHTML = `
            <div class="user-profile-menu">
                <div class="user-role-badge ${currentMeta.badgeClass}" title="Active Role">
                    <span>${currentMeta.icon} ${currentMeta.label}</span>
                </div>
                <div class="user-details-dropdown">
                    <button class="user-btn" id="user-menu-btn">
                        <span class="user-name">${this.currentUser.full_name.split(' ')[0]}</span>
                        <span class="caret">▼</span>
                    </button>
                    <div class="dropdown-panel" id="user-dropdown-panel">
                        <div class="dropdown-header">
                            <strong>${this.currentUser.full_name}</strong>
                            <small>${this.currentUser.email}</small>
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-section-title">Switch Role (Testing Mode):</div>
                        <div class="role-switcher-grid">
                            <button class="role-switch-btn ${this.currentUser.role === 'citizen' ? 'active' : ''}" onclick="window.civicfixAuth.switchRole('citizen')">👤 Citizen</button>
                            <button class="role-switch-btn ${this.currentUser.role === 'moderator' ? 'active' : ''}" onclick="window.civicfixAuth.switchRole('moderator')">🛡️ Moderator</button>
                            <button class="role-switch-btn ${this.currentUser.role === 'department_rep' ? 'active' : ''}" onclick="window.civicfixAuth.switchRole('department_rep')">🏢 Dept Rep</button>
                            <button class="role-switch-btn ${this.currentUser.role === 'admin' ? 'active' : ''}" onclick="window.civicfixAuth.switchRole('admin')">⚙️ Admin</button>
                        </div>
                        <div class="dropdown-divider"></div>
                        <a href="dashboard.html" class="dropdown-item">📊 My Dashboard</a>
                        <a href="complaints.html" class="dropdown-item">📋 View Complaints</a>
                        <a href="#" class="dropdown-item" onclick="window.civicfixAuth.showSupabaseModal(); return false;">⚡ Supabase API Setup</a>
                        <a href="#" class="dropdown-item text-danger" onclick="window.civicfixAuth.logout(); return false;">🚪 Logout</a>
                    </div>
                </div>
            </div>
        `;

        // Toggle dropdown logic
        const menuBtn = document.getElementById('user-menu-btn');
        const dropdownPanel = document.getElementById('user-dropdown-panel');
        if (menuBtn && dropdownPanel) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownPanel.classList.toggle('show');
            });

            document.addEventListener('click', () => {
                dropdownPanel.classList.remove('show');
            });
        }
    }

    /**
     * In-App Supabase API Key Configuration Modal
     */
    showSupabaseModal() {
        // Remove existing modal if any
        const existing = document.getElementById('supabase-config-modal');
        if (existing) existing.remove();

        const currentUrl = localStorage.getItem('civicfix_supabase_url') || '';
        const currentKey = localStorage.getItem('civicfix_supabase_key') || '';
        const isLive = Boolean(currentUrl && currentKey);

        const modal = document.createElement('div');
        modal.id = 'supabase-config-modal';
        modal.className = 'modal-backdrop show';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:1.5rem;';

        modal.innerHTML = `
            <div class="card" style="max-width:580px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); border:2px solid #bae6fd; padding:2rem;">
                <div class="flex-between mb-3" style="border-bottom:1px solid #e2e8f0; padding-bottom:1rem;">
                    <div>
                        <h2 style="font-size:1.35rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:0.5rem;">
                            ⚡ Supabase API Configuration
                        </h2>
                        <p class="text-xs text-muted mt-1">Connect CivicFix to your live PostgreSQL database or use built-in synthetic mode.</p>
                    </div>
                    <button type="button" class="btn btn-ghost btn-sm" id="btn-close-supa-modal" style="font-size:1.25rem; font-weight:bold; cursor:pointer;">&times;</button>
                </div>

                <!-- Current Mode Banner -->
                <div style="padding:0.85rem 1rem; border-radius:8px; margin-bottom:1.25rem; ${isLive ? 'background:#ecfdf5; border:1px solid #10b981; color:#065f46;' : 'background:#f0f9ff; border:1px solid #0284c7; color:#0369a1;'}">
                    <strong style="font-size:0.9rem;">${isLive ? '🟢 Live Supabase Mode Active' : '🔵 Built-in Synthetic Mode Active'}</strong>
                    <p style="font-size:0.8rem; margin-top:0.25rem; opacity:0.9;">
                        ${isLive ? 'Requests are synced with your live Supabase / PostgreSQL instance.' : 'Zero setup required! Running instantly with preloaded realistic civic complaint dataset.'}
                    </p>
                </div>

                <div class="form-group mb-3">
                    <label class="form-label" style="font-weight:700; font-size:0.88rem;" for="supa-project-url">Supabase Project URL</label>
                    <input type="url" id="supa-project-url" class="form-control" placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co" value="${currentUrl}">
                    <small class="form-hint">Found in Supabase Dashboard → Project Settings → API → Project URL.</small>
                </div>

                <div class="form-group mb-3">
                    <label class="form-label" style="font-weight:700; font-size:0.88rem;" for="supa-anon-key">Supabase Public Anon Key</label>
                    <textarea id="supa-anon-key" class="form-control" rows="3" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." style="font-family:monospace; font-size:0.82rem;">${currentKey}</textarea>
                    <small class="form-hint">Found in Supabase Dashboard → Project Settings → API → Project API Keys (anon / public).</small>
                </div>

                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:1.5rem; font-size:0.82rem; color:#475569; line-height:1.5;">
                    <strong style="color:#0f172a;">📋 Quick Setup Steps:</strong>
                    <ol style="margin-left:1.25rem; margin-top:0.35rem;">
                        <li>Create a free account and project at <a href="https://supabase.com" target="_blank" style="color:#0284c7; text-decoration:underline;">supabase.com</a>.</li>
                        <li>Open the <strong>SQL Editor</strong> tab in Supabase, copy the contents of <code>database/schema.sql</code>, and click <strong>Run</strong>.</li>
                        <li>Copy your <strong>Project URL</strong> and <strong>Anon Key</strong>, paste them above, and click <strong>Save & Reconnect</strong>.</li>
                    </ol>
                </div>

                <div class="flex-between flex-wrap gap-2 pt-3" style="border-top:1px solid #e2e8f0;">
                    <button type="button" class="btn btn-outline btn-sm text-danger" id="btn-reset-supa">
                        🔄 Reset to Synthetic Mode
                    </button>
                    <div style="display:flex; gap:0.5rem;">
                        <button type="button" class="btn btn-ghost btn-sm" id="btn-cancel-supa">Cancel</button>
                        <button type="button" class="btn btn-primary btn-sm" id="btn-save-supa">
                            💾 Save & Reconnect
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind events
        document.getElementById('btn-close-supa-modal').onclick = () => modal.remove();
        document.getElementById('btn-cancel-supa').onclick = () => modal.remove();

        document.getElementById('btn-save-supa').onclick = () => {
            const url = document.getElementById('supa-project-url').value.trim();
            const key = document.getElementById('supa-anon-key').value.trim();

            if (url && !key) {
                alert('Please enter your Supabase anon/public key.');
                return;
            }
            if (key && !url) {
                alert('Please enter your Supabase Project URL.');
                return;
            }

            if (url && key) {
                localStorage.setItem('civicfix_supabase_url', url);
                localStorage.setItem('civicfix_supabase_key', key);
                alert('✓ Supabase credentials saved! CivicFix will now connect to your live PostgreSQL database.');
            } else {
                localStorage.removeItem('civicfix_supabase_url');
                localStorage.removeItem('civicfix_supabase_key');
                alert('CivicFix is now running in built-in zero-config Synthetic Mode.');
            }

            modal.remove();
            window.location.reload();
        };

        document.getElementById('btn-reset-supa').onclick = () => {
            if (confirm('Reset to built-in zero-config synthetic database mode?')) {
                localStorage.removeItem('civicfix_supabase_url');
                localStorage.removeItem('civicfix_supabase_key');
                modal.remove();
                alert('Reset complete. CivicFix is now running in local zero-config mode.');
                window.location.reload();
            }
        };
    }
}

// Global instance
window.civicfixAuth = new CivicFixAuth();
