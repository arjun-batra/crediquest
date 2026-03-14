// ── Service Worker ──────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('[CQ] SW registered'))
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

    // ── App state ─────────────────────────────────────────────────────────
    let selectedCardIds  = [];
    let creditCardsCache = [];

    // ── Tangerine constants ───────────────────────────────────────────────
    // Tangerine lets holders choose 2–3 bonus categories that earn 2% cash back.
    // All other purchases earn 0.5%. We need to know which categories the user
    // has activated to show accurate results.
    const TANGERINE_CARD_ID = '13';

    // The 12 reward_type IDs Tangerine can earn 2% on (verified against DB)
    const TANGERINE_ELIGIBLE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]);

    // Ordered list for the picker UI
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
    const orientationEl = document.getElementById('orientation-warning');
    function checkOrientation() {
        orientationEl.classList.toggle('show',
            !window.matchMedia('(orientation: portrait)').matches);
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
        // Tangerine modal: do NOT close on backdrop tap — force a decision
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
    document.getElementById('contribute-btn').addEventListener('click', () => openModal('contribute-modal'));

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

            // For Tangerine: add a small badge showing bonus category status
            if (id === TANGERINE_CARD_ID) {
                const cats = getTangerineChosenCats();
                const badge = document.createElement('span');
                badge.className = 'tangerine-settings-badge';
                badge.id = 'tangerine-settings-badge';
                badge.textContent = cats.size >= 2
                    ? `${cats.size} bonus cats`
                    : 'set bonus cats';
                badge.addEventListener('click', e => {
                    e.stopPropagation();
                    openTangerinePicker(() => {
                        // Refresh badge after saving
                        const updated = getTangerineChosenCats();
                        badge.textContent = `${updated.size} bonus cats`;
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
    });

    function updateSelectAllLabel() {
        if (!cardsContainer.children.length) return;
        const pills = cardsContainer.querySelectorAll('.toggle-pill');
        const allOn = Array.from(pills).every(p => p.getAttribute('aria-checked') === 'true');
        selectAllBtn.textContent = allOn ? 'Deselect all' : 'Select all';
    }

    // ── Tangerine bonus category persistence ──────────────────────────────
    function getTangerineChosenCats() {
        const saved = localStorage.getItem('tangerineCategories');
        if (!saved) return new Set();
        return new Set(JSON.parse(saved).map(Number));
    }

    function saveTangerineChosenCats(idSet) {
        localStorage.setItem('tangerineCategories', JSON.stringify([...idSet]));
    }

    // ── Tangerine picker modal ────────────────────────────────────────────
    // Opens the bonus category picker. onSave() is called after the user
    // confirms. The modal cannot be dismissed by tapping the backdrop —
    // the user must either save or tap ✕ (which keeps the prior saved state).
    function openTangerinePicker(onSave) {
        const container = document.getElementById('tangerine-cats-container');
        const saveBtn   = document.getElementById('tangerine-save-btn');
        const countLbl  = document.getElementById('tangerine-count-label');
        const savedCats = getTangerineChosenCats();
        let selectedIds = new Set([...savedCats]);

        function updatePickerUI() {
            const count = selectedIds.size;
            countLbl.textContent = count === 0
                ? 'Select 2 or 3 categories'
                : count === 1
                    ? '1 selected — pick 1 or 2 more'
                    : `${count} of 3 selected`;
            countLbl.className = 'tangerine-count' + (count >= 2 ? ' tangerine-count--valid' : '');
            saveBtn.disabled = count < 2;

            // Disable unselected toggles when 3 are already chosen
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

        // Wire save — replaces any previous onclick to avoid stale closures
        saveBtn.onclick = () => {
            saveTangerineChosenCats(selectedIds);
            closeAll();
            onSave();
        };

        openModal('tangerine-modal');
    }

    // ── Tangerine multiplier adjustment ───────────────────────────────────
    // After fetching results, adjusts Tangerine's display multiplier:
    // • If the searched category is in the user's chosen bonus categories → 2x
    // • If the searched category is eligible but NOT chosen → 0.5x
    // • If the category is not eligible for Tangerine → unchanged (already 0.5x in DB)
    // Returns a new sorted array.
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

        // Re-sort: Tangerine's rank may change after adjustment
        return adjusted.sort((a, b) => b.multiplier - a.multiplier);
    }

    // ── Tangerine interception gate ───────────────────────────────────────
    // Called before fetching results. If Tangerine is selected, the category
    // is eligible, and no bonus cats are saved yet → open the picker first.
    // Otherwise proceeds directly to fetchCardRewards.
    function doFetch(rewardTypeId, displayName) {
        const tangerineSelected  = selectedCardIds.includes(TANGERINE_CARD_ID);
        const categoryIsEligible = TANGERINE_ELIGIBLE_IDS.has(Number(rewardTypeId));
        const catsAlreadySet     = getTangerineChosenCats().size >= 2;

        if (tangerineSelected && categoryIsEligible && !catsAlreadySet) {
            openTangerinePicker(() => fetchCardRewards(rewardTypeId, displayName));
            return;
        }
        fetchCardRewards(rewardTypeId, displayName);
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

    // ── Show results ──────────────────────────────────────────────────────
    function showResults(title, cards, rewardTypeId) {
        document.getElementById('results-title').textContent = title;
        const list = document.getElementById('results-list');
        list.innerHTML = '';

        if (!cards || cards.length === 0) {
            list.innerHTML =
                '<p class="results-empty">No rewards data found for your selected cards.<br>Open My Cards and make sure you have cards selected.</p>';
        } else {
            cards.forEach((card, i) => {
                const el = document.createElement('div');
                el.className = `result-card${i === 0 ? ' result-card--best' : ''}`;
                el.innerHTML = `
                    <span class="result-rank">${i === 0 ? '★' : `#${i + 1}`}</span>
                    <span class="result-name">${card.credit_cards.card_name}</span>
                    <span class="result-multiplier">${card.multiplier}×</span>
                `;
                list.appendChild(el);
            });

            // Tangerine note: shown when Tangerine is selected and category is eligible
            const showNote = selectedCardIds.includes(TANGERINE_CARD_ID)
                          && TANGERINE_ELIGIBLE_IDS.has(Number(rewardTypeId));
            if (showNote) {
                const chosenCats = getTangerineChosenCats();
                const catName    = TANGERINE_ELIGIBLE_CATS.find(c => c.id === Number(rewardTypeId))?.name || '';
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
                    openTangerinePicker(() => fetchCardRewards(rewardTypeId, title));
                });
            }
        }

        openModal('results-modal');
    }

    // ── Fetch card rewards ────────────────────────────────────────────────
    async function fetchCardRewards(rewardTypeId, displayName) {
        if (selectedCardIds.length === 0) {
            showResults(displayName, [], rewardTypeId);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await sb
                .from('credit_card_reward_types')
                .select('multiplier, credit_cards(card_name)')
                .in('credit_card_id', selectedCardIds)
                .eq('reward_type_id', Number(rewardTypeId))
                .order('multiplier', { ascending: false });

            if (error) throw error;

            // Adjust Tangerine's multiplier based on the user's chosen bonus categories
            const adjusted = adjustTangerineMultiplier(data, rewardTypeId);
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
            doFetch(categoryId, displayName);
            return;
        }

        setLoading(true);
        try {
            const { data: stores, error } = await sb
                .from('stores')
                .select('id, store_name, reward_type_id')
                .ilike('store_name', `%${storeName}%`)
                .limit(30);

            if (error) throw error;

            if (stores.length === 0) {
                showError(`No stores found matching "${storeName}". Try a broader term or use the category dropdown.`);
                return;
            }

            if (stores.length === 1) {
                doFetch(stores[0].reward_type_id, stores[0].store_name);
                return;
            }

            const storeList = document.getElementById('store-list');
            storeList.innerHTML = '';
            const chips = document.createElement('div');
            chips.className = 'store-chips';
            stores.forEach(store => {
                const chip = document.createElement('button');
                chip.className   = 'store-chip';
                chip.textContent = store.store_name;
                chip.addEventListener('click', () => {
                    closeAll();
                    doFetch(store.reward_type_id, store.store_name);
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

    // ── Startup ───────────────────────────────────────────────────────────
    (async () => {
        try {
            const [cardsResult] = await Promise.all([
                sb.from('credit_cards').select('id, card_name').order('card_name'),
                loadRewards()
            ]);
            if (cardsResult.error) throw cardsResult.error;
            creditCardsCache = cardsResult.data;
            initSelectedCards();
        } catch (e) {
            console.error('[CQ] startup failed:', e);
            showError('Failed to load app data. Check your connection and refresh.');
        }
    })();

}); // end DOMContentLoaded
