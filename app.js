// ── Service Worker ──────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
        .then(reg => {
            console.log('[CQ] SW registered');
            reg.update(); // proactively check for updates on every page load
        })
        .catch(e => console.warn('[CQ] SW failed:', e));
}

// ── App bootstrap ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // ── Supabase guard ────────────────────────────────────────────────────
    if (!window.supabase) {
        document.body.innerHTML =
            '<p style="padding:2rem;font-family:sans-serif;color:#666">Failed to load — check your connection and refresh.</p>';
        return;
    }

    const sb = window.supabase.createClient(
        'https://yaqarscylnpmmbllfwxw.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFyc2N5bG5wbW1ibGxmd3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTQ5MDIsImV4cCI6MjA0Nzk3MDkwMn0.KuYXx8b-5MKDLmW6DfoG5lyMZPwFMROlbnDC-vJZDd8'
    );

    // ── Analytics ─────────────────────────────────────────────────────────
    // Session ID: UUID generated once per browser session (resets on tab close).
    // Stored in sessionStorage — not a cookie, no personal data, no consent needed.
    const SESSION_ID = (() => {
        let id = sessionStorage.getItem('cq_session');
        if (!id) {
            id = crypto.randomUUID();
            sessionStorage.setItem('cq_session', id);
        }
        return id;
    })();

    // Device type: derived from userAgent and display mode
    const DEVICE_TYPE = (() => {
        const ua  = navigator.userAgent.toLowerCase();
        const pwa = window.matchMedia('(display-mode: standalone)').matches
                 || window.navigator.standalone === true;
        if (pwa)                                  return 'pwa';
        if (/ipad|tablet/.test(ua))               return 'tablet';
        if (/iphone|android|mobile/.test(ua))     return 'mobile';
        return 'desktop';
    })();

    // IS_MOBILE_PHONE: true only for phone-sized devices (iPhone, Android phone).
    // Distinct from DEVICE_TYPE because 'pwa' swallows all installed installs —
    // an iPad PWA returns 'pwa', not 'tablet'. This flag checks the UA directly
    // so we can correctly allow landscape on tablets regardless of install state.
    const IS_MOBILE_PHONE = (() => {
        const ua = navigator.userAgent.toLowerCase();
        return /iphone|android/.test(ua) && !/ipad|tablet/.test(ua);
    })();

    // logEvent: fire-and-forget, never throws, never blocks the UI.
    // All analytics calls use this — the rest of the app never awaits it.
    function logEvent(eventName, properties = {}) {
        sb.from('events').insert({
            event_name:  eventName,
            properties:  properties,
            session_id:  SESSION_ID,
            device_type: DEVICE_TYPE,
            app_version: '1.0.3',
        }).then(({ error }) => {
            if (error) console.warn('[CQ] analytics drop:', eventName, error.message);
        });
    }

    // ── App state ─────────────────────────────────────────────────────────
    let selectedCardIds  = [];
    // creditCardsCache: {id, card_name, point_value_cents}[]
    let creditCardsCache = [];
    // showPerDollar: toggles between raw multiplier and effective ¢/$1 return
    let showPerDollar = false;
    // lastResultsData: cached for re-rendering on toggle without re-fetching
    let lastResultsData = null;
    let lastRewardTypeId = null;
    // lastNetworkNotice: set when results are filtered by store network restriction
    let lastNetworkNotice = null;

    // ── Network restriction constants ─────────────────────────────────────
    // IDs of cards that are Mastercards — used to filter results at
    // Mastercard-only merchants (e.g. Costco).
    const MASTERCARD_CARD_IDS = new Set(['3', '5', '7', '9', '13', '16', '20', '21']);

    // Returns the subset of selectedCardIds eligible for a given network.
    // acceptedNetworks: null (all) | 'mastercard'
    function getEligibleCardIds(acceptedNetworks) {
        if (!acceptedNetworks) return selectedCardIds;
        if (acceptedNetworks === 'mastercard') {
            return selectedCardIds.filter(id => MASTERCARD_CARD_IDS.has(id));
        }
        return selectedCardIds;
    }

    // ── Tangerine constants ───────────────────────────────────────────────
    const TANGERINE_CARD_ID = '13';
    const TANGERINE_ELIGIBLE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]);
    const TANGERINE_ELIGIBLE_CATS = [
        { id: 1,  name: 'Drug stores' },
        { id: 5,  name: 'Entertainment' },
        { id: 4,  name: 'Fast Food Restaurants' },
        { id: 6,  name: 'Furniture' },
        { id: 7,  name: 'Gas' },
        { id: 8,  name: 'Grocery' },
        { id: 9,  name: 'Home Improvements' },
        { id: 10, name: 'Hotels-Motels' },
        { id: 3,  name: 'Lounge, Clubs, and Bars' },
        { id: 11, name: 'Public Transportation and Parking' },
        { id: 22, name: 'Recurring Bills' },
        { id: 2,  name: 'Restaurants' },
    ];

    // ── DOM refs ──────────────────────────────────────────────────────────
    const searchBtn      = document.getElementById('search-btn');
    const storeInput     = document.getElementById('store-name');
    const categorySelect = document.getElementById('reward-type');
    const spinner        = document.getElementById('spinner');
    const cardsContainer = document.getElementById('cards-container');
    const selectAllBtn   = document.getElementById('select-all-btn');

    // ── Orientation ───────────────────────────────────────────────────────
    // Only block landscape on mobile phones (iPhone / Android phone).
    // Tablets (browser or PWA) and desktops are free to rotate.
    const orientationEl = document.getElementById('orientation-warning');
    function checkOrientation() {
        orientationEl.classList.toggle('show',
            IS_MOBILE_PHONE && !window.matchMedia('(orientation: portrait)').matches);
    }
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();

    // ── Loading state ─────────────────────────────────────────────────────
    function setLoading(on) {
        spinner.classList.toggle('active', on);
        searchBtn.disabled = on;
    }

    // ── Modal management ──────────────────────────────────────────────────
    function openModal(id) {
        closeAll();
        const el = document.getElementById(id);
        if (el) el.classList.add('open');
    }

    function closeAll() {
        document.querySelectorAll('.modal.open')
            .forEach(m => m.classList.remove('open'));
    }

    document.addEventListener('click', e => {
        const closer = e.target.closest('[data-close]');
        if (closer) {
            document.getElementById(closer.dataset.close)?.classList.remove('open');
            return;
        }
        if (e.target.classList.contains('modal') &&
            e.target.id !== 'tangerine-modal') {
            closeAll();
        }
    });

    // Nav triggers
    document.getElementById('settings-btn').addEventListener('click', () => {
        renderToggles();
        openModal('settings-modal');
    });
    document.getElementById('about-btn').addEventListener('click',      () => openModal('about-modal'));
    document.getElementById('contribute-btn').addEventListener('click', () => {
        openModal('contribute-modal');
        initContributeForm();
    });

    // ── Contribute form ───────────────────────────────────────────────────
    // Populated once on first open — reuses creditCardsCache and a categories
    // list fetched from the DB. Tabs switch between three submission types.

    let contributeInitialised = false;

    function initContributeForm() {
        if (contributeInitialised) return;
        contributeInitialised = true;

        // Populate card dropdowns from cache
        const cardSelects = [document.getElementById('wm-card')];
        creditCardsCache.forEach(card => {
            cardSelects.forEach(sel => {
                const opt = document.createElement('option');
                opt.value       = card.card_name;
                opt.textContent = card.card_name;
                sel.appendChild(opt);
            });
        });

        // Populate category dropdowns from DB
        sb.from('reward_types').select('reward_type').order('reward_type')
            .then(({ data }) => {
                if (!data) return;
                const catSelects = [
                    document.getElementById('ms-category'),
                    document.getElementById('wm-category'),
                ];
                data.forEach(rt => {
                    catSelects.forEach(sel => {
                        const opt = document.createElement('option');
                        opt.value       = rt.reward_type;
                        opt.textContent = rt.reward_type;
                        sel.appendChild(opt);
                    });
                });
            });

        // Tab switching
        document.querySelectorAll('.suggest-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.suggest-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.suggest-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
                document.getElementById('suggest-status').textContent = '';
                document.getElementById('suggest-submit-btn').disabled = false;
            });
        });

        // Submit
        document.getElementById('suggest-submit-btn').addEventListener('click', submitSuggestion);
    }

    async function submitSuggestion() {
        const activeTab  = document.querySelector('.suggest-tab.active')?.dataset.tab;
        const statusEl   = document.getElementById('suggest-status');
        const submitBtn  = document.getElementById('suggest-submit-btn');
        let details = {};

        // Validate and collect fields per tab
        if (activeTab === 'missing_store') {
            const name = document.getElementById('ms-store-name').value.trim();
            const cat  = document.getElementById('ms-category').value;
            if (!name || !cat) {
                statusEl.textContent = 'Store name and category are required.';
                statusEl.className = 'suggest-status suggest-status--error';
                return;
            }
            details = { store_name: name, category: cat,
                        notes: document.getElementById('ms-notes').value.trim() };

        } else if (activeTab === 'wrong_multiplier') {
            const card = document.getElementById('wm-card').value;
            const cat  = document.getElementById('wm-category').value;
            const rate = document.getElementById('wm-correct-rate').value;
            if (!card || !cat || !rate) {
                statusEl.textContent = 'Card, category, and correct rate are required.';
                statusEl.className = 'suggest-status suggest-status--error';
                return;
            }
            details = { card_name: card, category: cat, correct_rate: Number(rate),
                        source: document.getElementById('wm-source').value.trim() };

        } else if (activeTab === 'new_card') {
            const name = document.getElementById('nc-card-name').value.trim();
            if (!name) {
                statusEl.textContent = 'Card name is required.';
                statusEl.className = 'suggest-status suggest-status--error';
                return;
            }
            details = { card_name: name,
                        issuer: document.getElementById('nc-issuer').value.trim(),
                        notes:  document.getElementById('nc-notes').value.trim() };
        }

        submitBtn.disabled = true;
        statusEl.textContent = 'Submitting…';
        statusEl.className = 'suggest-status';

        const { data: result, error } = await sb.rpc('submit_suggestion', {
            p_type:       activeTab,
            p_details:    details,
            p_session_id: SESSION_ID,
        });

        if (error || !result?.ok) {
            const msg = result?.error || 'Something went wrong — please try again.';
            console.error('[CQ] suggestion submit:', error || result?.error);
            statusEl.textContent = msg;
            statusEl.className = 'suggest-status suggest-status--error';
            submitBtn.disabled = false;
        } else {
            statusEl.textContent = '✓ Thanks! We\'ll review your suggestion.';
            statusEl.className = 'suggest-status suggest-status--success';
            document.querySelectorAll('#contribute-modal input, #contribute-modal select')
                .forEach(el => { el.value = el.tagName === 'SELECT' ? '' : ''; });
            logEvent('suggestion_submitted', { type: activeTab });
        }
    }

    // ── Results view toggle ───────────────────────────────────────────────
    const toggleMultiplierBtn = document.getElementById('toggle-multiplier');
    const togglePerDollarBtn  = document.getElementById('toggle-per-dollar');

    toggleMultiplierBtn.addEventListener('click', () => {
        if (showPerDollar) {
            showPerDollar = false;
            toggleMultiplierBtn.classList.add('active');
            togglePerDollarBtn.classList.remove('active');
            if (lastResultsData !== null) renderResults();
            logEvent('view_toggle', { mode: 'multiplier' });
        }
    });

    togglePerDollarBtn.addEventListener('click', () => {
        if (!showPerDollar) {
            showPerDollar = true;
            togglePerDollarBtn.classList.add('active');
            toggleMultiplierBtn.classList.remove('active');
            if (lastResultsData !== null) renderResults();
            logEvent('view_toggle', { mode: 'per_dollar' });
        }
    });

    // ── Error modal ───────────────────────────────────────────────────────
    function showError(msg) {
        document.getElementById('error-message').textContent = msg;
        openModal('error-modal');
    }

    // ── Card selection persistence ────────────────────────────────────────
    function saveCards() {
        localStorage.setItem('selectedCards', JSON.stringify(selectedCardIds));
    }

    function initSelectedCards() {
        const saved  = localStorage.getItem('selectedCards');
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed && parsed.length > 0) {
            selectedCardIds = parsed;
        } else {
            selectedCardIds = creditCardsCache.map(c => String(c.id));
            saveCards();
        }
    }

    // ── Point value lookup ────────────────────────────────────────────────
    // Returns the point_value_cents for a given card name from the cache
    function getPointValue(cardName) {
        const card = creditCardsCache.find(c => c.card_name === cardName);
        return card ? card.point_value_cents : 1.0;
    }

    // ── Settings toggles ──────────────────────────────────────────────────
    function renderToggles() {
        cardsContainer.innerHTML = '';
        creditCardsCache.forEach(card => {
            const id   = String(card.id);
            const isOn = selectedCardIds.includes(id);

            const row = document.createElement('div');
            row.className = 'card-toggle-row';
            row.setAttribute('data-id', id);

            const name = document.createElement('span');
            name.className = 'card-toggle-name';
            name.textContent = card.card_name;

            if (id === TANGERINE_CARD_ID) {
                const cats = getTangerineChosenCats();
                const badge = document.createElement('span');
                badge.className = 'tangerine-settings-badge';
                badge.id = 'tangerine-settings-badge';
                badge.textContent = cats.size >= 2
                    ? `${cats.size} bonus categories`
                    : 'set bonus categories';
                badge.addEventListener('click', e => {
                    e.stopPropagation();
                    openTangerinePicker(() => {
                        const updated = getTangerineChosenCats();
                        badge.textContent = `${updated.size} bonus categories`;
                    });
                });
                name.appendChild(badge);
            }

            const pill = document.createElement('button');
            pill.className = 'toggle-pill';
            pill.setAttribute('role', 'switch');
            pill.setAttribute('aria-checked', String(isOn));
            pill.setAttribute('aria-label', `Toggle ${card.card_name}`);
            pill.setAttribute('data-id', id);

            const thumb = document.createElement('span');
            thumb.className = 'toggle-thumb';
            pill.appendChild(thumb);

            function handleToggle(e) {
                e.stopPropagation();
                const checked = pill.getAttribute('aria-checked') === 'true';
                const newVal  = !checked;
                pill.setAttribute('aria-checked', String(newVal));
                if (newVal) {
                    if (!selectedCardIds.includes(id)) selectedCardIds.push(id);
                } else {
                    selectedCardIds = selectedCardIds.filter(i => i !== id);
                }
                saveCards();
                updateSelectAllLabel();
                // Invalidate cached results — card set changed, stale data must not re-render
                lastResultsData  = null;
                lastRewardTypeId = null;
                logEvent('settings_changed', {
                    action:    newVal ? 'card_added' : 'card_removed',
                    card_name: card.card_name,
                    cards_selected_count: selectedCardIds.length,
                });
            }

            row.addEventListener('click', handleToggle);
            pill.addEventListener('click', handleToggle);
            row.appendChild(name);
            row.appendChild(pill);
            cardsContainer.appendChild(row);
        });

        updateSelectAllLabel();
    }

    selectAllBtn.addEventListener('click', () => {
        const pills    = cardsContainer.querySelectorAll('.toggle-pill');
        const allOn    = Array.from(pills).every(p => p.getAttribute('aria-checked') === 'true');
        const newState = !allOn;
        pills.forEach(pill => pill.setAttribute('aria-checked', String(newState)));
        selectedCardIds = newState ? creditCardsCache.map(c => String(c.id)) : [];
        saveCards();
        updateSelectAllLabel();
        // Invalidate cached results — card set changed
        lastResultsData  = null;
        lastRewardTypeId = null;
    });

    function updateSelectAllLabel() {
        if (!cardsContainer.children.length) return;
        const pills = cardsContainer.querySelectorAll('.toggle-pill');
        const allOn = Array.from(pills).every(p => p.getAttribute('aria-checked') === 'true');
        selectAllBtn.textContent = allOn ? 'Deselect all' : 'Select all';
    }

    // ── Tangerine persistence ─────────────────────────────────────────────
    function getTangerineChosenCats() {
        const saved = localStorage.getItem('tangerineCategories');
        if (!saved) return new Set();
        return new Set(JSON.parse(saved).map(Number));
    }

    function saveTangerineChosenCats(idSet) {
        localStorage.setItem('tangerineCategories', JSON.stringify([...idSet]));
    }

    // ── Tangerine picker ──────────────────────────────────────────────────
    function openTangerinePicker(onSave) {
        const container = document.getElementById('tangerine-cats-container');
        const saveBtn   = document.getElementById('tangerine-save-btn');
        const countLbl  = document.getElementById('tangerine-count-label');
        const savedCats = getTangerineChosenCats();
        let selectedIds = new Set([...savedCats]);

        function updatePickerUI() {
            const count = selectedIds.size;
            countLbl.textContent = count === 0
                ? 'Select 2 or 3 bonus categories'
                : count === 1
                    ? '1 selected — pick 1 or 2 more'
                    : `${count} of 3 bonus categories selected`;
            countLbl.className = 'tangerine-count' + (count >= 2 ? ' tangerine-count--valid' : '');
            saveBtn.disabled = count < 2;
            container.querySelectorAll('.toggle-pill').forEach(pill => {
                const id    = Number(pill.dataset.catId);
                const isOn  = selectedIds.has(id);
                const limit = !isOn && count >= 3;
                pill.setAttribute('aria-disabled', String(limit));
                pill.closest('.card-toggle-row').classList.toggle('toggle-row--disabled', limit);
            });
        }

        container.innerHTML = '';
        TANGERINE_ELIGIBLE_CATS.forEach(cat => {
            const isOn = selectedIds.has(cat.id);

            const row = document.createElement('div');
            row.className = 'card-toggle-row';

            const name = document.createElement('span');
            name.className   = 'card-toggle-name';
            name.textContent = cat.name;

            const pill = document.createElement('button');
            pill.className = 'toggle-pill toggle-pill--orange';
            pill.setAttribute('role', 'switch');
            pill.setAttribute('aria-checked', String(isOn));
            pill.setAttribute('aria-label', `Toggle ${cat.name}`);
            pill.dataset.catId = cat.id;

            const thumb = document.createElement('span');
            thumb.className = 'toggle-thumb';
            pill.appendChild(thumb);

            function handleToggle(e) {
                e.stopPropagation();
                if (pill.getAttribute('aria-disabled') === 'true') return;
                const checked = pill.getAttribute('aria-checked') === 'true';
                const newVal  = !checked;
                pill.setAttribute('aria-checked', String(newVal));
                if (newVal) selectedIds.add(cat.id);
                else         selectedIds.delete(cat.id);
                updatePickerUI();
            }

            row.addEventListener('click', handleToggle);
            pill.addEventListener('click', handleToggle);
            row.appendChild(name);
            row.appendChild(pill);
            container.appendChild(row);
        });

        updatePickerUI();

        saveBtn.onclick = () => {
            saveTangerineChosenCats(selectedIds);
            logEvent('tangerine_categories_set', {
                chosen_count: selectedIds.size,
                category_ids: [...selectedIds].sort((a, b) => a - b),
                category_names: [...selectedIds].map(id =>
                    TANGERINE_ELIGIBLE_CATS.find(c => c.id === id)?.name
                ).filter(Boolean),
            });
            closeAll();
            onSave();
        };

        openModal('tangerine-modal');
    }

    // ── Tangerine multiplier adjustment ───────────────────────────────────
    function adjustTangerineMultiplier(data, rewardTypeId) {
        if (!selectedCardIds.includes(TANGERINE_CARD_ID)) return data;
        if (!TANGERINE_ELIGIBLE_IDS.has(Number(rewardTypeId))) return data;
        const chosenCats = getTangerineChosenCats();
        const isChosen   = chosenCats.has(Number(rewardTypeId));
        const adjusted = data.map(card => {
            if (card.credit_cards.card_name === 'Tangerine Money-Back Credit Card') {
                return { ...card, multiplier: isChosen ? 2 : 0.5 };
            }
            return card;
        });
        return adjusted.sort((a, b) => b.multiplier - a.multiplier);
    }

    // ── Tangerine interception gate ───────────────────────────────────────
    function doFetch(rewardTypeId, displayName, storeId = null, acceptedNetworks = null) {
        const tangerineSelected  = selectedCardIds.includes(TANGERINE_CARD_ID);
        const categoryIsEligible = TANGERINE_ELIGIBLE_IDS.has(Number(rewardTypeId));
        const catsAlreadySet     = getTangerineChosenCats().size >= 2;
        if (tangerineSelected && categoryIsEligible && !catsAlreadySet) {
            openTangerinePicker(() => fetchCardRewards(rewardTypeId, displayName, storeId, acceptedNetworks));
            return;
        }
        fetchCardRewards(rewardTypeId, displayName, storeId, acceptedNetworks);
    }

    // ── Rewards dropdown ──────────────────────────────────────────────────
    async function loadRewards() {
        const { data, error } = await sb
            .from('reward_types')
            .select('id, reward_type')
            .order('reward_type');
        if (error) { console.error('[CQ] loadRewards:', error); return; }
        const frag = document.createDocumentFragment();
        data.forEach(r => {
            const opt = document.createElement('option');
            opt.value       = r.id;
            opt.textContent = r.reward_type;
            frag.appendChild(opt);
        });
        categorySelect.appendChild(frag);
    }

    storeInput.addEventListener('input',      () => { categorySelect.value = ''; });
    categorySelect.addEventListener('change', () => { storeInput.value = ''; });

    // ── Render results (called by showResults and the toggle) ─────────────
    function renderResults() {
        if (!lastResultsData) return;
        const list = document.getElementById('results-list');
        list.innerHTML = '';

        const data = lastResultsData;
        const rewardTypeId = lastRewardTypeId;

        if (!data || data.length === 0) {
            list.innerHTML =
                '<p class="results-empty">No rewards data found for your selected cards.<br>Open My Cards and make sure you have cards selected.</p>';
            return;
        }

        // In per-dollar mode: compute effective return and re-sort
        let displayData;
        if (showPerDollar) {
            displayData = data.map(card => {
                const pv      = getPointValue(card.credit_cards.card_name);
                const effVal  = Math.round(card.multiplier * pv * 10) / 10; // 1dp
                return { ...card, displayValue: effVal };
            }).sort((a, b) => b.displayValue - a.displayValue);
        } else {
            displayData = data.map(card => ({ ...card, displayValue: null }));
        }

        displayData.forEach((card, i) => {
            if (i === 0) {
                // Wrap the best card + explanation together so they read as one unit
                const wrapper = document.createElement('div');
                wrapper.className = 'result-card-best-wrapper';

                const el = document.createElement('div');
                el.className = 'result-card result-card--best';

                const valueStr = showPerDollar
                    ? `${card.displayValue}¢`
                    : `${card.multiplier}×`;

                const overrideBadge = card.storeOverride
                    ? `<span class="override-badge">store bonus</span>`
                    : '';

                el.innerHTML = `
                    <span class="result-rank">★</span>
                    <span class="result-name">${card.credit_cards.card_name}${overrideBadge}</span>
                    <span class="result-multiplier">${valueStr}</span>
                `;

                const explanationEl = document.createElement('div');
                explanationEl.className = 'result-explanation';
                explanationEl.textContent = '';

                wrapper.appendChild(el);
                wrapper.appendChild(explanationEl);
                list.appendChild(wrapper);

                // Pass current rewardTypeId so the searched category is excluded from the list
                fetchTopCardExplanation(card.credit_card_id, card.multiplier, Number(rewardTypeId), explanationEl);
            } else {
                const el = document.createElement('div');
                el.className = 'result-card';

                const valueStr = showPerDollar
                    ? `${card.displayValue}¢`
                    : `${card.multiplier}×`;

                const overrideBadge = card.storeOverride
                    ? `<span class="override-badge">store bonus</span>`
                    : '';

                el.innerHTML = `
                    <span class="result-rank">#${i + 1}</span>
                    <span class="result-name">${card.credit_cards.card_name}${overrideBadge}</span>
                    <span class="result-multiplier">${valueStr}</span>
                `;
                list.appendChild(el);
            }
        });

        // Tangerine note
        const showNote = selectedCardIds.includes(TANGERINE_CARD_ID)
                      && TANGERINE_ELIGIBLE_IDS.has(Number(rewardTypeId));
        if (showNote) {
            const chosenCats = getTangerineChosenCats();
            const isChosen   = chosenCats.has(Number(rewardTypeId));
            const note = document.createElement('div');
            note.className = 'tangerine-note';
            note.innerHTML = `
                <span class="tangerine-note-icon">🍊</span>
                <span class="tangerine-note-text">
                    Tangerine showing ${isChosen ? '<strong>2%</strong> (your bonus category)' : '<strong>0.5%</strong> (not a bonus category)'}.
                </span>
                <button class="tangerine-note-btn" id="tangerine-note-edit">Change</button>
            `;
            list.appendChild(note);

            document.getElementById('tangerine-note-edit').addEventListener('click', () => {
                const title = document.getElementById('results-title').textContent;
                openTangerinePicker(() => fetchCardRewards(rewardTypeId, title, null, lastNetworkNotice));
            });
        }

        // Network restriction notice (e.g. Mastercard-only at Costco)
        if (lastNetworkNotice === 'mastercard') {
            const networkNote = document.createElement('div');
            networkNote.className = 'tangerine-note';
            networkNote.innerHTML = `
                <span class="tangerine-note-icon">💳</span>
                <span class="tangerine-note-text">
                    Costco only accepts <strong>Mastercard</strong> — showing your Mastercard cards only.
                </span>
            `;
            list.appendChild(networkNote);
        }

        // Per-dollar footnote explaining the valuation
        if (showPerDollar) {
            const footnote = document.createElement('p');
            footnote.className = 'results-footnote';
            footnote.textContent = 'Based on estimated point values: Amex MR 2¢, Aeroplan 1.6¢, BMO Rewards 0.67¢, TD Rewards 0.5¢, all others 1¢.';
            list.appendChild(footnote);
        }
    }

    // ── Top card explanation (Feature #6) ────────────────────────────────
    // Fetches categories where the #1 card earns its top multiplier,
    // excluding the one already searched so the list is additive context.
    // Fire-and-forget: never blocks the results render.
    async function fetchTopCardExplanation(cardId, topMultiplier, currentRewardTypeId, el) {
        if (!cardId) return;
        try {
            const { data, error } = await sb
                .from('credit_card_reward_types')
                .select('reward_type_id, multiplier, reward_types(reward_type)')
                .eq('credit_card_id', cardId)
                .eq('multiplier', topMultiplier)
                .neq('reward_type_id', currentRewardTypeId)  // exclude the searched category
                .order('reward_types(reward_type)');
            if (error || !data || data.length === 0) {
                el.remove();
                return;
            }

            const cats = data
                .map(r => r.reward_types?.reward_type)
                .filter(Boolean);

            if (cats.length === 0) {
                el.remove();
                return;
            }

            const rateStr = `${topMultiplier}×`;
            el.textContent = `Also earns ${rateStr} on: ${cats.join(', ')}`;
        } catch (e) {
            el.remove();
        }
    }

    // ── Show results modal ────────────────────────────────────────────────
    function showResults(title, cards, rewardTypeId) {
        document.getElementById('results-title').textContent = title;
        lastResultsData  = cards;
        lastRewardTypeId = rewardTypeId;
        renderResults();
        openModal('results-modal');
        logEvent('result_viewed', {
            search_term:      title,
            reward_type_id:   Number(rewardTypeId),
            result_count:     cards ? cards.length : 0,
            cards_selected:   selectedCardIds.length,
            top_card:         cards && cards.length > 0 ? cards[0].credit_cards.card_name : null,
            top_multiplier:   cards && cards.length > 0 ? cards[0].multiplier : null,
        });
    }

    // ── Fetch card rewards ────────────────────────────────────────────────
    // storeId: when a specific store was selected (not category dropdown),
    // we also fetch store-level overrides and apply them on top of the
    // category rate. Override wins. Re-sorts after merge.
    async function fetchCardRewards(rewardTypeId, displayName, storeId = null, acceptedNetworks = null) {
        if (selectedCardIds.length === 0) {
            showResults(displayName, [], rewardTypeId);
            return;
        }

        // Filter card IDs by network restriction (e.g. Mastercard-only at Costco)
        const eligibleCardIds = getEligibleCardIds(acceptedNetworks);
        const networkFiltered = eligibleCardIds.length < selectedCardIds.length;
        lastNetworkNotice = networkFiltered ? acceptedNetworks : null;

        if (eligibleCardIds.length === 0) {
            lastNetworkNotice = acceptedNetworks;
            showResults(displayName, [], rewardTypeId);
            return;
        }

        setLoading(true);
        try {
            // Always fetch category rates. Include credit_card_id so we can
            // match override rows back to the correct result entry.
            const { data, error } = await sb
                .from('credit_card_reward_types')
                .select('credit_card_id, multiplier, credit_cards(card_name)')
                .in('credit_card_id', eligibleCardIds)
                .eq('reward_type_id', Number(rewardTypeId))
                .order('multiplier', { ascending: false });
            if (error) throw error;

            let results = data;

            // Fetch store-level overrides when searching by store
            if (storeId) {
                const { data: overrideRows, error: overrideError } = await sb
                    .from('credit_card_store_overrides')
                    .select('credit_card_id, multiplier')
                    .eq('store_id', storeId)
                    .in('credit_card_id', eligibleCardIds);

                if (!overrideError && overrideRows && overrideRows.length > 0) {
                    // Build lookup: card_id → override multiplier
                    const overrideMap = {};
                    overrideRows.forEach(o => {
                        overrideMap[o.credit_card_id] = Number(o.multiplier);
                    });

                    // Apply overrides — replace multiplier and flag the row
                    results = data.map(card => {
                        const ov = overrideMap[card.credit_card_id];
                        if (ov !== undefined) {
                            return { ...card, multiplier: ov, storeOverride: true };
                        }
                        return card;
                    }).sort((a, b) => b.multiplier - a.multiplier);
                }
            }

            const adjusted = adjustTangerineMultiplier(results, rewardTypeId);
            showResults(displayName, adjusted, rewardTypeId);
        } catch (e) {
            console.error('[CQ] fetchCardRewards:', e);
            showError('Could not load card rewards. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    // ── Main search ───────────────────────────────────────────────────────
    async function search() {
        const categoryId = categorySelect.value;
        const storeName  = storeInput.value.trim();

        if (!categoryId && !storeName) {
            showError('Please enter a store name or select a spending category.');
            return;
        }

        if (categoryId) {
            const displayName = categorySelect.options[categorySelect.selectedIndex].text;
            logEvent('search', { method: 'category', category: displayName, category_id: Number(categoryId) });
            doFetch(categoryId, displayName);
            return;
        }

        setLoading(true);
        try {
            const { data: stores, error } = await sb
                .from('stores')
                .select('id, store_name, reward_type_id, accepted_networks')
                .ilike('store_name', `%${storeName}%`)
                .limit(50);
            if (error) throw error;

            if (stores.length === 0) {
                logEvent('search', { method: 'store', query: storeName, result_count: 0 });
                showError(`No stores found matching "${storeName}". Try a broader term or use the category dropdown.`);
                return;
            }
            if (stores.length === 1) {
                logEvent('search', { method: 'store', query: storeName, result_count: 1, store_name: stores[0].store_name });
                doFetch(stores[0].reward_type_id, stores[0].store_name, stores[0].id, stores[0].accepted_networks);
                return;
            }

            logEvent('search', { method: 'store', query: storeName, result_count: stores.length });

            const storeList = document.getElementById('store-list');
            storeList.innerHTML = '';

            // Show a notice when results are capped
            if (stores.length === 50) {
                const cap = document.createElement('p');
                cap.className = 'store-cap-notice';
                cap.textContent = 'Showing top 50 results — try a more specific search term.';
                storeList.appendChild(cap);
            }

            const chips = document.createElement('div');
            chips.className = 'store-chips';
            stores.forEach(store => {
                const chip = document.createElement('button');
                chip.className   = 'store-chip';
                chip.textContent = store.store_name;
                chip.addEventListener('click', () => {
                    closeAll();
                    logEvent('store_selected', { store_name: store.store_name, reward_type_id: store.reward_type_id });
                    doFetch(store.reward_type_id, store.store_name, store.id, store.accepted_networks);
                });
                chips.appendChild(chip);
            });
            storeList.appendChild(chips);
            openModal('store-modal');
        } catch (e) {
            console.error('[CQ] search stores:', e);
            showError('Could not search stores. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    searchBtn.addEventListener('click', search);
    storeInput.addEventListener('keypress',     e => { if (e.key === 'Enter') search(); });
    categorySelect.addEventListener('keypress', e => { if (e.key === 'Enter') search(); });

    // ── Startup — now fetches point_value_cents too ───────────────────────
    (async () => {
        try {
            const [cardsResult] = await Promise.all([
                sb.from('credit_cards')
                    .select('id, card_name, point_value_cents')
                    .order('card_name'),
                loadRewards()
            ]);
            if (cardsResult.error) throw cardsResult.error;
            creditCardsCache = cardsResult.data;
            initSelectedCards();

            // Fire app_load after cards are ready so we know cards_selected_count
            logEvent('app_load', {
                device_type:          DEVICE_TYPE,
                cards_selected_count: selectedCardIds.length,
                tangerine_selected:   selectedCardIds.includes(TANGERINE_CARD_ID),
                tangerine_cats_set:   getTangerineChosenCats().size,
                referrer:             document.referrer || 'direct',
            });

        } catch (e) {
            console.error('[CQ] startup failed:', e);
            showError('Failed to load app data. Check your connection and refresh.');
        }
    })();

    // ── PWA Install Banner ────────────────────────────────────────────────────
    const INSTALL_DISMISSED_KEY = 'cq_install_dismissed';
    const INSTALL_DISMISS_DAYS  = 15;

    const bannerEl      = document.getElementById('install-banner');
    const bannerBtn     = document.getElementById('install-banner-btn');
    const bannerDismiss = document.getElementById('install-banner-dismiss');
    const bannerSub     = document.getElementById('install-banner-sub');
    const iosSteps      = document.getElementById('install-banner-ios-steps');

    let deferredPrompt = null;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                      || window.navigator.standalone === true;
    const isIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid    = /android/i.test(navigator.userAgent);

    function isDismissed() {
        const ts = localStorage.getItem(INSTALL_DISMISSED_KEY);
        if (!ts) return false;
        const daysSince = (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24);
        return daysSince < INSTALL_DISMISS_DAYS;
    }

    function recordDismissal() {
        localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    }

    function showBanner() {
        if (isDismissed() || isStandalone) return;
        bannerEl.hidden = false;
        setTimeout(() => bannerEl.classList.add('install-banner--visible'), 1500);
    }

    function hideBanner() {
        bannerEl.classList.remove('install-banner--visible');
        setTimeout(() => { bannerEl.hidden = true; }, 350);
    }

    bannerDismiss.addEventListener('click', () => {
        hideBanner();
        recordDismissal();
        logEvent('pwa_install_dismissed', { platform: isIOS ? 'ios' : 'android' });
    });

    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        logEvent('pwa_install_prompted', { platform: 'android' });
        bannerBtn.textContent = 'Install';
        showBanner();
    });

    bannerBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            hideBanner();
            recordDismissal();
            logEvent(outcome === 'accepted' ? 'pwa_installed' : 'pwa_install_dismissed',
                     { platform: 'android', outcome });
        }
    });

    window.addEventListener('appinstalled', () => {
        hideBanner();
        recordDismissal();
        logEvent('pwa_installed', { platform: 'android' });
    });

    if (isIOS && !isStandalone && !isDismissed()) {
        bannerBtn.hidden    = true;
        iosSteps.hidden     = false;
        bannerSub.textContent = 'Install in 2 taps';
        logEvent('pwa_install_prompted', { platform: 'ios' });
        showBanner();
    }

}); // end DOMContentLoaded
