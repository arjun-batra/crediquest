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
    // selectedCardIds: string[]   — persisted in localStorage
    // creditCardsCache: {id, card_name}[] — loaded once at startup, never re-fetched
    let selectedCardIds  = [];
    let creditCardsCache = [];

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

    // Unified event delegation for all close buttons and backdrop taps
    document.addEventListener('click', e => {
        // [data-close] attribute on buttons
        const closer = e.target.closest('[data-close]');
        if (closer) {
            document.getElementById(closer.dataset.close)?.classList.remove('open');
            return;
        }
        // Tap on the dark backdrop (the .modal itself, not the .modal-box)
        if (e.target.classList.contains('modal')) closeAll();
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

    // ── localStorage helpers ──────────────────────────────────────────────
    function saveCards() {
        localStorage.setItem('selectedCards', JSON.stringify(selectedCardIds));
    }

    // Reads from creditCardsCache (already loaded) — no extra fetch needed
    function initSelectedCards() {
        const saved  = localStorage.getItem('selectedCards');
        const parsed = saved ? JSON.parse(saved) : null;

        if (parsed && parsed.length > 0) {
            selectedCardIds = parsed;
        } else {
            // Default: all cards selected
            selectedCardIds = creditCardsCache.map(c => String(c.id));
            saveCards();
        }
    }

    // ── Toggle switches (Settings) ────────────────────────────────────────
    function renderToggles() {
        cardsContainer.innerHTML = '';

        creditCardsCache.forEach(card => {
            const id      = String(card.id);
            const isOn    = selectedCardIds.includes(id);

            // Row wrapper (tappable)
            const row = document.createElement('div');
            row.className = 'card-toggle-row';
            row.setAttribute('data-id', id);

            // Card name label
            const name = document.createElement('span');
            name.className   = 'card-toggle-name';
            name.textContent = card.card_name;

            // Toggle pill button
            const pill = document.createElement('button');
            pill.className  = 'toggle-pill';
            pill.setAttribute('role', 'switch');
            pill.setAttribute('aria-checked', String(isOn));
            pill.setAttribute('aria-label', `Toggle ${card.card_name}`);
            pill.setAttribute('data-id', id);

            // Sliding thumb
            const thumb = document.createElement('span');
            thumb.className = 'toggle-thumb';
            pill.appendChild(thumb);

            // Tap on either the row or the pill toggles the card
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

    // Select all / Deselect all
    selectAllBtn.addEventListener('click', () => {
        const pills    = cardsContainer.querySelectorAll('.toggle-pill');
        const allOn    = Array.from(pills).every(p => p.getAttribute('aria-checked') === 'true');
        const newState = !allOn;

        pills.forEach(pill => {
            pill.setAttribute('aria-checked', String(newState));
        });

        selectedCardIds = newState
            ? creditCardsCache.map(c => String(c.id))
            : [];

        saveCards();
        updateSelectAllLabel();
    });

    function updateSelectAllLabel() {
        if (!cardsContainer.children.length) return;
        const pills  = cardsContainer.querySelectorAll('.toggle-pill');
        const allOn  = Array.from(pills).every(p => p.getAttribute('aria-checked') === 'true');
        selectAllBtn.textContent = allOn ? 'Deselect all' : 'Select all';
    }

    // ── Rewards dropdown ──────────────────────────────────────────────────
    async function loadRewards() {
        const { data, error } = await sb
            .from('reward_types')
            .select('id, reward_type')
            .order('reward_type');
        if (error) {
            console.error('[CQ] loadRewards:', error);
            return;
        }
        const frag = document.createDocumentFragment();
        data.forEach(r => {
            const opt = document.createElement('option');
            opt.value       = r.id;
            opt.textContent = r.reward_type;
            frag.appendChild(opt);
        });
        categorySelect.appendChild(frag);
    }

    // Mutual exclusivity: using one input clears the other
    storeInput.addEventListener('input',      () => { categorySelect.value = ''; });
    categorySelect.addEventListener('change', () => { storeInput.value = ''; });

    // ── Show results modal ────────────────────────────────────────────────
    function showResults(title, cards) {
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
        }
        openModal('results-modal');
    }

    // ── Fetch card rewards for a given reward type ────────────────────────
    async function fetchCardRewards(rewardTypeId, displayName) {
        if (selectedCardIds.length === 0) {
            showResults(displayName, []);
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
            showResults(displayName, data);
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

        // Category path:
        // Name is already in the DOM — no extra DB round-trip needed
        if (categoryId) {
            const displayName = categorySelect.options[categorySelect.selectedIndex].text;
            await fetchCardRewards(categoryId, displayName);
            return;
        }

        // Store search path
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

            // Single result: skip the picker, go straight to results
            if (stores.length === 1) {
                await fetchCardRewards(stores[0].reward_type_id, stores[0].store_name);
                return;
            }

            // Multiple results: show the store picker
            const storeList = document.getElementById('store-list');
            storeList.innerHTML = '';

            const chips = document.createElement('div');
            chips.className = 'store-chips';

            stores.forEach(store => {
                const chip = document.createElement('button');
                chip.className   = 'store-chip';
                chip.textContent = store.store_name;
                chip.addEventListener('click', async () => {
                    closeAll();
                    await fetchCardRewards(store.reward_type_id, store.store_name);
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

    // Search triggers
    searchBtn.addEventListener('click', search);
    storeInput.addEventListener('keypress',     e => { if (e.key === 'Enter') search(); });
    categorySelect.addEventListener('keypress', e => { if (e.key === 'Enter') search(); });

    // ── Startup — parallel fetch ──────────────────────────────────────────
    // Cards (id + card_name) and rewards dropdown load simultaneously.
    // creditCardsCache is populated before initSelectedCards runs,
    // so initSelectedCards never needs its own DB call.
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
