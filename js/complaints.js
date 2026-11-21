/**
 * CivicFix - Complaint Management Logic
 * Handles submission, robust AI categorization with fuzzy typo matching & human confirmation,
 * duplicate detection, priority calculation (severity, affected people, report age, duplicates),
 * filtering, and role-based status workflows.
 */

class ComplaintsController {
    constructor() {
        this.samplePhotos = {
            drainage: 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?auto=format&fit=crop&w=800&q=80',
            garbage: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
            pothole: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
            streetlight: 'https://images.unsplash.com/photo-1509390144011-8ec2e76d2036?auto=format&fit=crop&w=800&q=80',
            park: 'https://images.unsplash.com/photo-1579618218290-24a26f634ff9?auto=format&fit=crop&w=800&q=80'
        };

        // Common civic typos, abbreviations & slang mapping
        this.typoMap = {
            // Garbage typos & variations
            'grabage': 'garbage', 'garbag': 'garbage', 'garbge': 'garbage', 'gargabe': 'garbage',
            'garbeg': 'garbage', 'garb': 'garbage', 'trsh': 'trash', 'tras': 'trash',
            'wast': 'waste', 'wste': 'waste', 'waster': 'waste', 'dumpstr': 'dumpster',
            'dampster': 'dumpster', 'dompster': 'dumpster', 'rubish': 'rubbish',
            'litr': 'litter', 'dustbin': 'dumpster', 'stink': 'odor', 'stinky': 'odor',
            'smely': 'smell', 'smelly': 'smell',

            // Drainage typos & variations
            'drane': 'drain', 'dran': 'drain', 'drange': 'drainage', 'drainag': 'drainage',
            'drinage': 'drainage', 'draing': 'drainage', 'sewerg': 'sewer', 'sewar': 'sewer',
            'sewerage': 'sewer', 'suage': 'sewage', 'sewege': 'sewage', 'sewre': 'sewer',
            'guttr': 'gutter', 'guter': 'gutter', 'manhol': 'manhole', 'leek': 'leak',
            'leeking': 'leak', 'chok': 'clog', 'choked': 'clog', 'choking': 'clog',
            'waterlog': 'waterlogging', 'watar': 'water', 'flooded': 'flood', 'flooding': 'flood',

            // Roads typos & variations
            'pothl': 'pothole', 'pothle': 'pothole', 'pot-hole': 'pothole', 'pot_hole': 'pothole',
            'pothols': 'potholes', 'pothles': 'potholes', 'rodes': 'road', 'rod': 'road',
            'asfualt': 'asphalt', 'asphlat': 'asphalt', 'cratr': 'crater', 'sidwalk': 'sidewalk',
            'pavment': 'pavement', 'curbe': 'curb',

            // Streetlight typos & variations
            'stret': 'street', 'streat': 'street', 'stretlight': 'streetlight', 'streetlite': 'streetlight',
            'stretlit': 'streetlight', 'lite': 'light', 'electrc': 'electric', 'electrik': 'electric',
            'cabel': 'cable', 'transfomer': 'transformer', 'blub': 'bulb', 'dangler': 'wire',

            // Infrastructure & Parks typos & variations
            'prk': 'park', 'benche': 'bench', 'sheltar': 'shelter', 'fenc': 'fence', 'playgroud': 'playground'
        };
    }

    // Levenshtein distance for fuzzy typo matching
    _levenshtein(s1, s2) {
        if (!s1 || !s2) return 99;
        if (s1 === s2) return 0;
        if (s1.length < s2.length) return this._levenshtein(s2, s1);
        if (s2.length === 0) return s1.length;

        let prev = Array.from({ length: s2.length + 1 }, (_, i) => i);
        for (let i = 0; i < s1.length; i++) {
            let curr = [i + 1];
            for (let j = 0; j < s2.length; j++) {
                let ins = prev[j + 1] + 1;
                let del = curr[j] + 1;
                let sub = prev[j] + (s1[i] !== s2[j] ? 1 : 0);
                curr.push(Math.min(ins, del, sub));
            }
            prev = curr;
        }
        return prev[prev.length - 1];
    }

    // ------------------------------------------------------------------------
    // ROBUST AI-ASSISTED COMPLAINT CATEGORIZATION ENGINE
    // Handles typos, fuzzy matching, synonyms, and single-word inputs
    // ------------------------------------------------------------------------
    analyzeComplaintCategory(textTitle, textDescription, categories) {
        if (!textTitle && !textDescription) return null;

        const rawCombined = `${textTitle || ''} ${textDescription || ''}`.toLowerCase();
        // Extract word tokens (minimum 2 characters)
        const tokens = rawCombined.replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length >= 2);

        if (tokens.length === 0) return null;

        // Normalize tokens using common typo map
        const normalizedTokens = tokens.map(t => this.typoMap[t] || t);

        let bestCategory = null;
        let highestScore = 0;
        let matchedReasons = [];

        categories.forEach(cat => {
            let score = 0;
            const matches = [];
            const keywords = cat.keywords || [];

            // Add code or name words as keywords
            const catNameWords = cat.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const allKeywords = Array.from(new Set([...keywords, ...catNameWords]));

            normalizedTokens.forEach((token, idx) => {
                const origToken = tokens[idx];

                // 1. Direct match with category keyword
                if (allKeywords.includes(token)) {
                    score += 15;
                    matches.push(origToken !== token ? `"${origToken}" (resolved as "${token}")` : `"${token}"`);
                    return;
                }

                // 2. Substring match (e.g. "drain" in "drainage", "waterlog" in "waterlogging")
                for (const kw of allKeywords) {
                    if (token.length >= 4 && kw.length >= 4) {
                        if (token.includes(kw) || kw.includes(token)) {
                            score += 10;
                            matches.push(`"${origToken}" (matches "${kw}")`);
                            return;
                        }
                    }

                    // 3. Fuzzy Levenshtein match (tolerance <= 2 for words >= 5 letters)
                    if (token.length >= 5 && kw.length >= 5) {
                        const dist = this._levenshtein(token, kw);
                        if (dist <= 2) {
                            score += 12;
                            matches.push(`"${origToken}" (typo match for "${kw}")`);
                            return;
                        }
                    } else if (token.length === 4 && kw.length === 4) {
                        if (this._levenshtein(token, kw) === 1) {
                            score += 8;
                            matches.push(`"${origToken}" (~"${kw}")`);
                            return;
                        }
                    }
                }
            });

            if (score > highestScore) {
                highestScore = score;
                bestCategory = cat;
                matchedReasons = Array.from(new Set(matches));
            }
        });

        if (bestCategory && highestScore > 0) {
            // Confidence formula normalized between 75% and 98%
            const confidence = Math.min(98, Math.round(75 + Math.min(23, highestScore * 1.5)));
            return {
                suggestedCategory: bestCategory,
                confidencePercent: confidence,
                detectedTokens: matchedReasons.slice(0, 4),
                reason: `Identified civic context: ${matchedReasons.slice(0, 3).join(', ')}`
            };
        }

        return null;
    }

    // ------------------------------------------------------------------------
    // DISPLAY AI CONFIRMATION BANNER (HUMAN CONFIRMATION REQUIRED)
    // ------------------------------------------------------------------------
    showAiConfirmationBanner(result) {
        const aiBanner = document.getElementById('ai-category-suggestion');
        const catSelect = document.getElementById('complaint-category');
        if (!aiBanner || !catSelect) return;

        aiBanner.style.display = 'block';
        aiBanner.innerHTML = `
            <div class="ai-suggestion-box">
                <div class="ai-header">
                    <span class="ai-badge">🤖 AI-Assisted Recommendation</span>
                    <span class="ai-confidence">${result.confidencePercent}% Confidence</span>
                </div>
                <div class="ai-body">
                    <div class="text-xs text-muted font-bold uppercase">Suggested Category:</div>
                    <div class="ai-suggested-name">${result.suggestedCategory.icon} ${result.suggestedCategory.name}</div>
                    <p class="ai-reason">${result.reason}</p>
                </div>
                <span class="ai-confirmation-notice">
                    ⚠️ <strong>Human Confirmation Required:</strong> The category will only be applied after you click "Accept & Apply".
                </span>
                <div class="ai-actions">
                    <button type="button" class="btn btn-sm btn-primary" id="btn-apply-ai">
                        ✓ Accept & Apply Category
                    </button>
                    <button type="button" class="btn btn-sm btn-outline" id="btn-dismiss-ai">
                        ✕ Keep Current Selection
                    </button>
                </div>
            </div>
        `;

        document.getElementById('btn-apply-ai').onclick = () => {
            catSelect.value = result.suggestedCategory.id;
            catSelect.classList.add('highlight-applied');
            setTimeout(() => catSelect.classList.remove('highlight-applied'), 1800);
            aiBanner.innerHTML = `
                <div class="alert alert-success p-3 mb-4" style="background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; color: #065f46;">
                    ✓ Confirmed by User: Category set to <strong>${result.suggestedCategory.icon} ${result.suggestedCategory.name}</strong>.
                </div>
            `;
            setTimeout(() => { aiBanner.style.display = 'none'; }, 2500);

            // Update priority preview
            const sev = document.getElementById('complaint-severity')?.value;
            const aff = document.getElementById('complaint-affected')?.value;
            if (sev && aff) {
                const { score, level } = window.civicfixDB.calculatePriority(sev, aff, new Date(), 0);
                const scoreDisplay = document.getElementById('priority-score-display');
                const badgeDisplay = document.getElementById('priority-badge-display');
                if (scoreDisplay) scoreDisplay.textContent = score.toFixed(1);
                if (badgeDisplay) {
                    badgeDisplay.className = `badge badge-priority badge-${level}`;
                    badgeDisplay.textContent = level.toUpperCase();
                }
            }
        };

        document.getElementById('btn-dismiss-ai').onclick = () => {
            aiBanner.style.display = 'none';
        };
    }

    // ------------------------------------------------------------------------
    // SUBMISSION FORM INITIALIZATION & EVENTS
    // ------------------------------------------------------------------------
    initSubmissionForm() {
        const form = document.getElementById('complaint-form');
        if (!form) return;

        const titleInput = document.getElementById('complaint-title');
        const descInput = document.getElementById('complaint-description');
        const catSelect = document.getElementById('complaint-category');
        const severitySelect = document.getElementById('complaint-severity');
        const affectedSelect = document.getElementById('complaint-affected');
        const photoInput = document.getElementById('complaint-photo');
        const photoPreview = document.getElementById('photo-preview');
        const aiBanner = document.getElementById('ai-category-suggestion');
        const duplicateWarning = document.getElementById('duplicate-detection-alert');
        const priorityScoreDisplay = document.getElementById('priority-score-display');
        const priorityBadge = document.getElementById('priority-badge-display');

        let uploadedPhotoData = this.samplePhotos.drainage;
        let lastSuggestedId = null;

        // Populate Category Dropdown
        window.civicfixDB.getCategories().then(({ data: categories }) => {
            catSelect.innerHTML = '<option value="">-- Select Category --</option>' +
                categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

            // AI Categorization trigger on typing
            const triggerAI = () => {
                const title = titleInput.value.trim();
                const desc = descInput.value.trim();
                if (!title && !desc) return;

                const result = this.analyzeComplaintCategory(title, desc, categories);
                if (result && (!catSelect.value || catSelect.value === lastSuggestedId)) {
                    lastSuggestedId = result.suggestedCategory.id;
                    this.showAiConfirmationBanner(result);
                }
            };

            titleInput.addEventListener('input', () => {
                if (titleInput.value.trim().length >= 3) triggerAI();
            });
            descInput.addEventListener('input', () => {
                if (descInput.value.trim().length >= 4) triggerAI();
            });

            // Duplicate Detection Trigger
            const checkDuplicatesNow = async () => {
                const lat = parseFloat(document.getElementById('loc-latitude').value) || 37.7749;
                const lng = parseFloat(document.getElementById('loc-longitude').value) || -122.4194;
                const catId = catSelect.value;
                const title = titleInput.value.trim();
                const desc = descInput.value.trim();

                if ((title.length >= 4 || desc.length >= 8) && catId) {
                    const matches = await window.civicfixDB.checkDuplicates(lat, lng, catId, title, desc);
                    if (matches.length > 0) {
                        const top = matches[0];
                        duplicateWarning.style.display = 'block';
                        duplicateWarning.innerHTML = `
                            <div class="duplicate-alert-card">
                                <div class="dup-header">
                                    <span>⚠️ Potential Duplicate Report Detected Nearby!</span>
                                    <span class="dup-score">${top.similarityPercent}% Similarity</span>
                                </div>
                                <div class="dup-content">
                                    <p>An existing issue matches your report in this vicinity: 
                                       <strong>#${top.complaint.tracking_number}: ${top.complaint.title}</strong>
                                    </p>
                                    <div class="dup-meta">
                                        <span>📏 Proximity: ~${top.distanceMeters}m away</span>
                                        <span>📍 ${top.complaint.location.locality_name}</span>
                                        <span>👥 Affected: ${top.complaint.affected_people}</span>
                                        <span>Status: <span class="badge badge-status badge-${top.complaint.status}">${top.complaint.status}</span></span>
                                    </div>
                                    <div class="dup-reasons">
                                        ${top.matchReasons.map(r => `<span class="dup-tag">• ${r}</span>`).join(' ')}
                                    </div>
                                </div>
                                <div class="dup-actions">
                                    <input type="hidden" id="linked-parent-id" value="${top.complaint.id}">
                                    <button type="button" class="btn btn-sm btn-outline" onclick="window.open('complaint-details.html?id=${top.complaint.id}', '_blank')">
                                        🔍 View Existing Complaint
                                    </button>
                                    <button type="button" class="btn btn-sm btn-primary" id="btn-confirm-link-dup">
                                        🔗 Link My Report to Existing Issue
                                    </button>
                                </div>
                            </div>
                        `;

                        document.getElementById('btn-confirm-link-dup').onclick = () => {
                            document.getElementById('is-linked-duplicate').value = top.complaint.id;
                            alert(`Your report will be linked to primary issue #${top.complaint.tracking_number}. This boosts the issue's priority score!`);
                            duplicateWarning.innerHTML = `<div class="alert alert-success p-3 mb-3">✓ Linked as duplicate to #${top.complaint.tracking_number}. Submitting will escalate the priority score!</div>`;
                        };
                    } else {
                        duplicateWarning.style.display = 'none';
                    }
                } else {
                    duplicateWarning.style.display = 'none';
                }
            };

            titleInput.addEventListener('blur', checkDuplicatesNow);
            descInput.addEventListener('blur', checkDuplicatesNow);
            catSelect.addEventListener('change', checkDuplicatesNow);
            document.getElementById('loc-latitude')?.addEventListener('change', checkDuplicatesNow);
            document.getElementById('loc-longitude')?.addEventListener('change', checkDuplicatesNow);
        });

        // Dynamic Priority Calculation Preview (Severity + Affected People + Report Age + Duplicates)
        const updatePriority = () => {
            const sev = severitySelect.value;
            const aff = affectedSelect.value;
            const isDup = document.getElementById('is-linked-duplicate')?.value ? 1 : 0;
            const { score, level } = window.civicfixDB.calculatePriority(sev, aff, new Date(), isDup);

            if (priorityScoreDisplay) priorityScoreDisplay.textContent = score.toFixed(1);
            if (priorityBadge) {
                priorityBadge.className = `badge badge-priority badge-${level}`;
                priorityBadge.textContent = level.toUpperCase();
            }
        };

        severitySelect.addEventListener('change', updatePriority);
        affectedSelect.addEventListener('change', updatePriority);
        updatePriority();

        // Photo Upload & Preview
        if (photoInput && photoPreview) {
            photoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        uploadedPhotoData = event.target.result;
                        photoPreview.src = uploadedPhotoData;
                        photoPreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Quick Sample Photo Buttons for fast evaluation
        window.setSamplePhoto = (type) => {
            if (this.samplePhotos[type]) {
                uploadedPhotoData = this.samplePhotos[type];
                photoPreview.src = uploadedPhotoData;
                photoPreview.style.display = 'block';
            }
        };

        // Form Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = titleInput.value.trim();
            const description = descInput.value.trim();
            const category_id = catSelect.value;
            const severity = severitySelect.value;
            const affected_people = affectedSelect.value;

            // Manual Location fields
            const locality = document.getElementById('loc-locality').value.trim() || 'Central District';
            const ward = document.getElementById('loc-ward').value.trim() || 'Ward 1';
            const address = document.getElementById('loc-address').value.trim() || 'Main Road';
            const landmark = document.getElementById('loc-landmark')?.value || '';
            const latitude = parseFloat(document.getElementById('loc-latitude').value) || 37.7749;
            const longitude = parseFloat(document.getElementById('loc-longitude').value) || -122.4194;
            const parentComplaintId = document.getElementById('is-linked-duplicate')?.value || null;

            if (!title || !description || !category_id) {
                alert('Please fill out the title, category, and description.');
                return;
            }

            const currentUser = window.civicfixAuth.getCurrentUser();

            const payload = {
                title,
                description,
                category_id,
                severity,
                affected_people,
                citizen_id: currentUser ? currentUser.id : '33333333-3333-3333-3333-333333333301',
                photo_url: uploadedPhotoData,
                parent_complaint_id: parentComplaintId,
                location: {
                    locality_name: locality,
                    ward_number: ward,
                    address,
                    landmark,
                    latitude,
                    longitude
                }
            };

            const submitBtn = document.getElementById('btn-submit-complaint');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = 'Submitting Complaint...';
            }

            try {
                const { data: newComplaint, error } = await window.civicfixDB.createComplaint(payload);
                if (error) throw new Error(error);

                alert(`🎉 Complaint Lodged Successfully!\nTracking ID: ${newComplaint.tracking_number}\nPriority Score: ${newComplaint.priority_score} (${newComplaint.priority_level.toUpperCase()})\nAffected People: ${newComplaint.affected_people}`);
                window.location.href = `complaint-details.html?id=${newComplaint.id}`;
            } catch (err) {
                alert('Error creating complaint: ' + err.message);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Submit Complaint';
                }
            }
        });
    }

    // ------------------------------------------------------------------------
    // COMPLAINTS LIST / TABLE VIEW INITIALIZATION
    // ------------------------------------------------------------------------
    async initComplaintsList() {
        const container = document.getElementById('complaints-table-body');
        if (!container) return;

        const statusFilter = document.getElementById('filter-status');
        const categoryFilter = document.getElementById('filter-category');
        const departmentFilter = document.getElementById('filter-department');
        const severityFilter = document.getElementById('filter-severity');
        const searchInput = document.getElementById('filter-search');
        const countDisplay = document.getElementById('complaints-count');

        // Populate filters
        const [categoriesRes, deptsRes] = await Promise.all([
            window.civicfixDB.getCategories(),
            window.civicfixDB.getDepartments()
        ]);

        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
                categoriesRes.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        if (departmentFilter) {
            departmentFilter.innerHTML = '<option value="all">All Departments</option>' +
                deptsRes.data.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        const render = async () => {
            const filter = {
                status: statusFilter ? statusFilter.value : 'all',
                category_id: categoryFilter ? categoryFilter.value : 'all',
                department_id: departmentFilter ? departmentFilter.value : 'all',
                severity: severityFilter ? severityFilter.value : 'all',
                search: searchInput ? searchInput.value.trim() : ''
            };

            const user = window.civicfixAuth.getCurrentUser();
            const roleFilterTab = document.querySelector('.role-tab.active')?.dataset.roleTab;

            if (roleFilterTab === 'my_reports' && user) {
                filter.citizen_id = user.id;
            } else if (roleFilterTab === 'my_dept' && user && user.department_id) {
                filter.department_id = user.department_id;
            } else if (roleFilterTab === 'needs_verification') {
                filter.status = 'submitted';
            } else if (roleFilterTab === 'overdue') {
                filter.is_escalated = true;
            }

            const { data: complaints } = await window.civicfixDB.getComplaints(filter);

            if (countDisplay) {
                countDisplay.textContent = `${complaints.length} complaint${complaints.length === 1 ? '' : 's'} found`;
            }

            if (complaints.length === 0) {
                container.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-8 text-muted" style="padding: 3rem 1rem;">
                            <p style="font-size: 1.05rem;">No complaints match the selected filters.</p>
                        </td>
                    </tr>
                `;
                return;
            }

            container.innerHTML = complaints.map(c => {
                // Calculate age in days
                const ageDays = Math.max(0, Math.round((Date.now() - new Date(c.created_at).getTime()) / (1000 * 86400)));
                const ageText = ageDays === 0 ? 'Today' : `${ageDays}d ago`;

                return `
                    <tr class="${c.is_escalated ? 'table-row-escalated' : ''}">
                        <td>
                            <strong class="tracking-code">#${c.tracking_number}</strong>
                            ${c.parent_complaint_id ? '<span class="badge badge-outline-warning" title="Linked as Duplicate">🔗 Duplicate</span>' : ''}
                            ${c.is_escalated ? '<span class="badge badge-danger" title="Overdue SLA">⚠️ ESCALATED</span>' : ''}
                        </td>
                        <td>
                            <div class="complaint-title-cell">
                                <a href="complaint-details.html?id=${c.id}" class="complaint-link font-bold">${this._escape(c.title)}</a>
                                <small class="text-muted block" style="margin-top: 0.2rem;">📍 ${this._escape(c.location.locality_name)} (${c.location.ward_number})</small>
                            </div>
                        </td>
                        <td>
                            <span class="category-pill">${c.category.icon} ${c.category.name}</span>
                        </td>
                        <td>
                            <span class="dept-name font-bold" style="color: #475569;">${c.department ? c.department.code : 'Unassigned'}</span>
                        </td>
                        <td>
                            <div style="font-size: 0.85rem; line-height: 1.4;">
                                <span class="badge badge-neutral" style="margin-bottom: 0.2rem;">👥 ${c.affected_people}</span>
                                <small class="text-muted block">⏱️ ${ageText}</small>
                            </div>
                        </td>
                        <td>
                            <div class="priority-meter">
                                <span class="badge badge-priority badge-${c.priority_level}">${c.priority_level.toUpperCase()}</span>
                                <small class="score-val" style="display: block; font-weight: 700; color: #0284c7; margin-top: 0.2rem;">Score: ${c.priority_score}</small>
                            </div>
                        </td>
                        <td>
                            <span class="badge badge-status badge-${c.status}">${c.status.replace('_', ' ').toUpperCase()}</span>
                        </td>
                        <td>
                            <a href="complaint-details.html?id=${c.id}" class="btn btn-sm btn-outline">Details →</a>
                        </td>
                    </tr>
                `;
            }).join('');
        };

        if (statusFilter) statusFilter.addEventListener('change', render);
        if (categoryFilter) categoryFilter.addEventListener('change', render);
        if (departmentFilter) departmentFilter.addEventListener('change', render);
        if (severityFilter) severityFilter.addEventListener('change', render);
        if (searchInput) searchInput.addEventListener('input', render);

        // Role tab filters
        document.querySelectorAll('.role-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                render();
            });
        });

        // Listen for data change
        window.addEventListener('civicfix_data_changed', render);
        window.addEventListener('civicfix_role_changed', render);

        render();
    }

    // ------------------------------------------------------------------------
    // COMPLAINT DETAILS VIEW (REFINED & PROPERLY SPACED)
    // ------------------------------------------------------------------------
    async initComplaintDetails() {
        const params = new URLSearchParams(window.location.search);
        const complaintId = params.get('id');

        if (!complaintId) {
            document.getElementById('details-content').innerHTML = `
                <div class="card p-6 text-center">
                    <h3>No Complaint Specified</h3>
                    <p class="text-muted mt-2">Please return to the <a href="complaints.html">Complaints Directory</a> to select an issue.</p>
                </div>
            `;
            return;
        }

        const renderDetails = async () => {
            const { data: complaint, error } = await window.civicfixDB.getComplaintById(complaintId);
            if (error || !complaint) {
                document.getElementById('details-content').innerHTML = `
                    <div class="card p-6 text-center">
                        <h3>Complaint Not Found</h3>
                        <p class="text-muted mt-2">${error || 'The requested ticket does not exist in the database.'}</p>
                    </div>
                `;
                return;
            }

            const currentUser = window.civicfixAuth.getCurrentUser();
            const container = document.getElementById('details-content');

            // Calculate precise age in days
            const ageDays = Math.max(0, parseFloat(((Date.now() - new Date(complaint.created_at).getTime()) / (1000 * 86400)).toFixed(1)));
            const ageDaysInt = Math.floor(ageDays);
            const ageText = ageDaysInt === 0 ? 'Reported today (< 24h)' : `${ageDaysInt} day${ageDaysInt > 1 ? 's' : ''} ago (${ageDays} days)`;

            container.innerHTML = `
                <div class="details-grid">
                    <!-- Left Column: Core Info, Photo, Priority Breakdown -->
                    <div class="details-main">
                        <div class="card details-header-card">
                            <div class="details-top-bar">
                                <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                                    <span class="tracking-number-badge">#${complaint.tracking_number}</span>
                                    <span class="badge badge-status badge-${complaint.status} text-uppercase">
                                        ${complaint.status.replace('_', ' ')}
                                    </span>
                                    ${complaint.is_escalated ? '<span class="badge badge-danger">⚠️ ESCALATED (Overdue)</span>' : ''}
                                    ${complaint.parent_complaint ? `<span class="badge badge-outline-warning">🔗 Linked to #${complaint.parent_complaint.tracking_number}</span>` : ''}
                                </div>
                                <span class="created-time">Lodged on ${new Date(complaint.created_at).toLocaleDateString()} at ${new Date(complaint.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <h1 class="details-title">${this._escape(complaint.title)}</h1>

                            <div class="details-meta-grid">
                                <div class="meta-item">
                                    <span class="meta-label">Category</span>
                                    <span class="meta-val">${complaint.category.icon} ${complaint.category.name}</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">Department</span>
                                    <span class="meta-val">${complaint.department ? complaint.department.name : 'Unassigned'}</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">Location</span>
                                    <span class="meta-val">📍 ${this._escape(complaint.location.locality_name)} (${complaint.location.ward_number})</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">Reported by</span>
                                    <span class="meta-val">👤 ${this._escape(complaint.citizen.full_name)}</span>
                                </div>
                            </div>

                            <div class="details-section">
                                <h3>📄 Problem Description</h3>
                                <div class="description-text">${this._escape(complaint.description)}</div>
                            </div>

                            <div class="details-section">
                                <h3>📍 Location & Geographical Coordinates</h3>
                                <div style="background: #f8fafc; border: 1px solid var(--slate-200); padding: 1.25rem 1.5rem; border-radius: var(--radius-sm); line-height: 1.8;">
                                    <p><strong>Address:</strong> ${this._escape(complaint.location.address || 'Not specified')}</p>
                                    ${complaint.location.landmark ? `<p><strong>Landmark:</strong> ${this._escape(complaint.location.landmark)}</p>` : ''}
                                    <p><strong>Locality & Ward:</strong> ${this._escape(complaint.location.locality_name)}, ${this._escape(complaint.location.ward_number)}</p>
                                    <p><strong>Coordinates:</strong> <code>, </code></p>
                                    <div class="mt-2">
                                        <a href="public-map.html?lat=&lng=" class="btn btn-xs btn-outline" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.65rem; font-size: 0.8rem;">
                                            🗺️ Inspect on Public GIS Map →
                                        </a>
                                    </div>
                                </div>
                            </div>

                            ${complaint.photo_url ? `
                                <div class="details-section">
                                    <h3>📸 Attached Photograph</h3>
                                    <div class="photo-container">
                                        <img src="${complaint.photo_url}" alt="Complaint Photo" class="details-photo" onclick="window.open(this.src, '_blank')">
                                    </div>
                                    <small class="text-muted block mt-2">Click image to open in full resolution.</small>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Priority Calculation Breakdown (Highlighting Affected People & Report Age) -->
                        <div class="card priority-breakdown-card">
                            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0369a1; margin-bottom: 0.5rem;">
                                📊 Priority Score & Impact Analysis
                            </h3>
                            <p class="text-sm text-muted mb-3">
                                Algorithmic dispatch score dynamically calculated from four core factors:
                            </p>

                            <div class="priority-factors-grid">
                                <div class="factor-box">
                                    <span class="factor-title">1. Issue Severity</span>
                                    <span class="factor-val text-uppercase">${complaint.severity}</span>
                                    <span class="factor-sub">${complaint.severity === 'critical' ? '4 pts (x2.5 wt)' : complaint.severity === 'high' ? '3 pts (x2.5 wt)' : '2 pts (x2.5 wt)'}</span>
                                </div>

                                <div class="factor-box" style="border: 2px solid #0284c7; background: #f0f9ff;">
                                    <span class="factor-title" style="color: #0369a1;">2. Affected People</span>
                                    <span class="factor-val" style="color: #0369a1;">👥 ${complaint.affected_people}</span>
                                    <span class="factor-sub">${complaint.affected_people === '200+' ? '4 pts (x1.5 wt)' : complaint.affected_people === '50-200' ? '3 pts (x1.5 wt)' : '2 pts (x1.5 wt)'}</span>
                                </div>

                                <div class="factor-box" style="border: 2px solid #f59e0b; background: #fffbeb;">
                                    <span class="factor-title" style="color: #b45309;">3. Report Age</span>
                                    <span class="factor-val" style="color: #b45309;">⏱️ ${ageDaysInt} Days</span>
                                    <span class="factor-sub">+${(ageDays * 0.5).toFixed(1)} pts age weight</span>
                                </div>

                                <div class="factor-box">
                                    <span class="factor-title">4. Duplicate Reports</span>
                                    <span class="factor-val">🔗 ${complaint.duplicate_count || 0}</span>
                                    <span class="factor-sub">+${(complaint.duplicate_count || 0) * 1.0} pts duplicate wt</span>
                                </div>
                            </div>

                            <div class="priority-summary-bar">
                                <div>
                                    <span class="text-muted text-sm font-bold block">Total Computed Priority Score:</span>
                                    <strong style="font-size: 1.75rem; color: #0f172a;">${complaint.priority_score} <span style="font-size: 1rem; color: #64748b;">/ 20.0</span></strong>
                                </div>
                                <div>
                                    <span class="badge badge-priority badge-${complaint.priority_level}" style="font-size: 0.95rem; padding: 0.45rem 1rem;">
                                        TIER: ${complaint.priority_level.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Duplicate Reports Attached -->
                        ${complaint.duplicate_reports && complaint.duplicate_reports.length > 0 ? `
                            <div class="card p-5 mt-4">
                                <h3>🔗 Linked Duplicate Citizen Reports (${complaint.duplicate_reports.length})</h3>
                                <p class="text-muted text-sm mb-3">These citizen reports were merged into this ticket because they describe the same issue nearby.</p>
                                <div class="duplicate-list">
                                    ${complaint.duplicate_reports.map(d => `
                                        <div class="duplicate-item" style="padding: 0.85rem; background: #f8fafc; border: 1px solid var(--slate-200); border-radius: 6px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <strong>#${d.tracking_number}</strong>: ${this._escape(d.title)}
                                                <small class="block text-muted">👥 Affected: ${d.affected_people} • Lodged by ${this._escape(d.citizen.full_name)}</small>
                                            </div>
                                            <a href="complaint-details.html?id=${d.id}" class="btn btn-sm btn-outline">View Ticket</a>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Right Column: Workflow Actions & Timeline -->
                    <div class="details-sidebar">
                        <!-- Role-based Action Panel -->
                        <div class="card p-5 action-card mb-4">
                            <h3 class="mb-3" style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">⚙️ Resolution Action Desk</h3>
                            <div class="current-role-badge mb-3" style="background: #f1f5f9; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem;">
                                Active Role: <strong>${currentUser ? currentUser.full_name : 'Guest'}</strong> (${currentUser ? currentUser.role : 'citizen'})
                            </div>

                            <div id="role-action-controls">
                                ${this._renderRoleActions(complaint, currentUser)}
                            </div>
                        </div>

                        <!-- Lifecycle Status Timeline -->
                        <div class="card p-5 timeline-card">
                            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">📜 Status History & Audit Trail</h3>
                            <p class="text-xs text-muted mb-3">Chronological record of state transitions, field updates, and moderation reviews.</p>
                            
                            <div class="status-timeline">
                                ${complaint.timeline.map((step) => `
                                    <div class="timeline-item">
                                        <div class="timeline-marker"></div>
                                        <div class="timeline-content">
                                            <div class="timeline-header">
                                                <span class="badge badge-status badge-${step.new_status}">${step.new_status.replace('_', ' ').toUpperCase()}</span>
                                                <small class="timeline-date">${new Date(step.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</small>
                                            </div>
                                            <p class="timeline-remarks">${this._escape(step.remarks)}</p>
                                            <small class="timeline-actor">👤 By: ${this._escape(step.actor_name)} (${step.actor_role})</small>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this._bindActionEvents(complaint, currentUser, renderDetails);
        };

        window.addEventListener('civicfix_role_changed', renderDetails);
        renderDetails();
    }

    _renderRoleActions(complaint, user) {
        if (!user) {
            return `<p class="text-muted">Please <a href="login.html">log in</a> to take action.</p>`;
        }

        const role = user.role;

        // Citizen actions
        if (role === 'citizen') {
            return `
                <div class="action-form">
                    <p class="text-sm text-muted mb-2">As a citizen, you can add follow-up remarks or feedback for field inspectors.</p>
                    <textarea id="action-remarks" class="form-control mb-3" rows="3" placeholder="Add follow-up notes or verification remarks..."></textarea>
                    <button class="btn btn-primary btn-block btn-sm" id="btn-citizen-remark">Submit Citizen Note</button>
                </div>
            `;
        }

        // Moderator actions
        if (role === 'moderator') {
            return `
                <div class="action-form">
                    <label class="form-label" style="font-size: 0.88rem;">Moderator Verification & Routing</label>
                    <p class="text-xs text-muted mb-3">Verify ground report, review duplicates, or route to department.</p>
                    <textarea id="action-remarks" class="form-control mb-3" rows="2" placeholder="Moderation verification remarks..."></textarea>
                    
                    <div class="btn-group-stacked">
                        ${complaint.status === 'submitted' ? `
                            <button class="btn btn-success btn-block mb-2" id="btn-mod-verify">✓ Verify Complaint</button>
                        ` : ''}
                        
                        <button class="btn btn-primary btn-block mb-2" id="btn-mod-assign">🏢 Assign / Route Department</button>
                        
                        ${complaint.status !== 'rejected' && complaint.status !== 'resolved' ? `
                            <button class="btn btn-danger btn-block mb-2" id="btn-mod-reject">✕ Reject Complaint</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Department Representative actions
        if (role === 'department_rep') {
            return `
                <div class="action-form">
                    <label class="form-label" style="font-size: 0.88rem;">Department Resolution Controls</label>
                    <p class="text-xs text-muted mb-3">Update field crew progress or close ticket upon completion.</p>
                    <textarea id="action-remarks" class="form-control mb-3" rows="3" placeholder="Describe field crew action taken or materials used..."></textarea>
                    
                    <div class="btn-group-stacked">
                        ${complaint.status !== 'in_progress' && complaint.status !== 'resolved' ? `
                            <button class="btn btn-warning btn-block mb-2" id="btn-dept-inprogress">⏳ Start Resolution (In Progress)</button>
                        ` : ''}

                        ${complaint.status !== 'resolved' ? `
                            <button class="btn btn-success btn-block mb-2" id="btn-dept-resolve">✓ Mark as Resolved</button>
                        ` : '<div class="alert alert-success p-3 text-center" style="background:#ecfdf5; border-radius:6px; color:#065f46; font-weight:700;">✓ This issue has been resolved.</div>'}
                    </div>
                </div>
            `;
        }

        // Administrator actions
        if (role === 'admin') {
            return `
                <div class="action-form">
                    <label class="form-label" style="font-size: 0.88rem;">Administrator Controls</label>
                    <textarea id="action-remarks" class="form-control mb-3" rows="2" placeholder="Admin override reason..."></textarea>
                    <div class="btn-group-stacked">
                        <button class="btn btn-primary btn-block mb-2" id="btn-admin-status-modal">Change Status Directly</button>
                        <button class="btn btn-outline btn-block mb-2" id="btn-admin-escalate">⚡ Force Escalation Notice</button>
                    </div>
                </div>
            `;
        }

        return '';
    }

    _bindActionEvents(complaint, user, refreshCallback) {
        if (!user) return;

        const remarksInput = document.getElementById('action-remarks');

        // Citizen follow-up
        const btnCitizen = document.getElementById('btn-citizen-remark');
        if (btnCitizen) {
            btnCitizen.onclick = async () => {
                const remarks = remarksInput.value.trim();
                if (!remarks) return alert('Please enter remarks.');
                await window.civicfixDB.updateComplaintStatus(complaint.id, complaint.status, `Citizen follow-up: ${remarks}`, user);
                refreshCallback();
            };
        }

        // Moderator Verify
        const btnModVerify = document.getElementById('btn-mod-verify');
        if (btnModVerify) {
            btnModVerify.onclick = async () => {
                const remarks = remarksInput.value.trim() || 'Verified by municipal moderator after ground inspection.';
                await window.civicfixDB.updateComplaintStatus(complaint.id, 'verified', remarks, user);
                refreshCallback();
            };
        }

        // Moderator Reject
        const btnModReject = document.getElementById('btn-mod-reject');
        if (btnModReject) {
            btnModReject.onclick = async () => {
                const reason = prompt('Please enter rejection reason (e.g., out of municipal jurisdiction, false report):');
                if (!reason) return;
                await window.civicfixDB.updateComplaintStatus(complaint.id, 'rejected', `Rejected: ${reason}`, user);
                refreshCallback();
            };
        }

        // Moderator Assign Department
        const btnModAssign = document.getElementById('btn-mod-assign');
        if (btnModAssign) {
            btnModAssign.onclick = async () => {
                const { data: depts } = await window.civicfixDB.getDepartments();
                const deptList = depts.map((d, i) => `${i + 1}. ${d.name} (${d.code})`).join('\n');
                const choice = prompt(`Select Department by entering number:\n${deptList}`);
                const idx = parseInt(choice) - 1;
                if (!isNaN(idx) && depts[idx]) {
                    const notes = remarksInput ? remarksInput.value.trim() : '';
                    await window.civicfixDB.assignComplaint(complaint.id, depts[idx].id, null, notes, user);
                    refreshCallback();
                }
            };
        }

        // Dept Rep In Progress
        const btnDeptProgress = document.getElementById('btn-dept-inprogress');
        if (btnDeptProgress) {
            btnDeptProgress.onclick = async () => {
                const remarks = remarksInput.value.trim() || 'Work crew dispatched to site. Repair in progress.';
                await window.civicfixDB.updateComplaintStatus(complaint.id, 'in_progress', remarks, user);
                refreshCallback();
            };
        }

        // Dept Rep Mark Resolved
        const btnDeptResolve = document.getElementById('btn-dept-resolve');
        if (btnDeptResolve) {
            btnDeptResolve.onclick = async () => {
                const remarks = remarksInput.value.trim() || 'Physical maintenance work completed successfully. Site restored.';
                await window.civicfixDB.updateComplaintStatus(complaint.id, 'resolved', remarks, user);
                refreshCallback();
            };
        }

        // Admin Force Escalation
        const btnAdminEscalate = document.getElementById('btn-admin-escalate');
        if (btnAdminEscalate) {
            btnAdminEscalate.onclick = async () => {
                complaint.is_escalated = true;
                complaint.escalation_reason = 'Escalated by Administrative Priority Command';
                const db = window.civicfixDB.getLocalDB();
                const c = db.complaints.find(i => i.id === complaint.id);
                if (c) {
                    c.is_escalated = true;
                    c.escalation_reason = 'Administrative manual escalation override';
                    window.civicfixDB.saveLocalDB(db);
                }
                alert('Complaint marked as Escalated. Urgent notifications dispatched.');
                refreshCallback();
            };
        }

        // Admin Direct Status Change
        const btnAdminStatus = document.getElementById('btn-admin-status-modal');
        if (btnAdminStatus) {
            btnAdminStatus.onclick = async () => {
                const statuses = ['submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected'];
                const choice = prompt(`Select status number:\n` + statuses.map((s, i) => `${i + 1}. ${s}`).join('\n'));
                const idx = parseInt(choice) - 1;
                if (!isNaN(idx) && statuses[idx]) {
                    const remarks = remarksInput ? remarksInput.value.trim() : 'Admin status override';
                    await window.civicfixDB.updateComplaintStatus(complaint.id, statuses[idx], remarks, user);
                    refreshCallback();
                }
            };
        }
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
window.complaintsCtrl = new ComplaintsController();

