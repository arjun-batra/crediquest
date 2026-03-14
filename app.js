// ── Service Worker ─────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('[CQ] SW registered'))
        .catch(e => console.warn('[CQ] SW failed:', e));
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // ── Supabase ────────────────────────────────────────────────────────────
    if (!window.supabase) {
        document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif;color:#888">Failed to load — please check your connection and refresh.</p>';
        return;
    }
    const sb = window.supabase.createClient(
        'https://yaqarscylnpmmbllfwxw.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFyc2N5bG5wbW1ibGxmd3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTQ5MDIsImV4cCI6MjA0Nzk3MDkwMn0.KuYXx8b-5MKDLmW6DfoG5lyMZPwFMROlbnDC-vJZDd8'
    );

    // ── State ───────────────────────────────────────────────────────────────
    // selectedCardIds: string[] — persisted to localStorage
    // creditCardsCache: {id, card_name}[] — loaded once at startup
    let selectedCardIds  = [];
    let creditCardsCache = [];

    // ── DOM ─────────────────────────────────────────────────────────────────
    const searchBtn       = document.getElementById('search-btn');
    const storeInput      = document.getElementById('store-name');
    const categorySelect  = document.getElementById('reward-type');
    const spinner         = document.getElementById('spinner');
    const cardsContainer  = document.getElementById('cards-container');
    const selectAllBtn    = document.getElementById('select-all-btn');

    // ── Orientation ─────────────────────────────────────────────────────────
    const orientationEl = document.getElementById('orientation-warning');
    const checkOrientation = () => {
        orientationEl.classList.toggle('show',
            !window.matchMedia('(orientation: portrait)').matches);
    };
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();

    // ── Modals ──────────────────────────────────────────────────────────────
    function openModal(id) {
        closeAllModals();
        document.getElementById(id)?.classList.add('open');
    }

    function closeAllModals() {
        document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    }

    // Close buttons via data-close attribute
    document.addEventListener('click', e => {
        const closeTarget = e.target.closest('[data-close]');
        if (closeTarget) document.getElementById(closeTarget.dataset.close)?.classList.remove('open');

        // Click outside modal box closes it
        if (e.target.classList.contains('modal')) closeAllModals();
    });

    // Nav buttons
    document.getElementById('settings-btn').addEventListener('click', () => {
        renderCardCheckboxes();
        openModal('settings-modal');
    });
    document.getElementById('about-btn').addEventListener('click',      () => openModal('about-modal'));
    document.getElementById('contribute-btn').addEventListener('click', () => openModal('contribute-modal'));

    // ── Spinner ──────────────────────────────────────────────────────────────
    const setLoading = on => {
        spinner.classList.toggle('active', on);
        searchBtn.disabled = on;
    };

    // ── Error display ────────────────────────────────────────────────────────
    function showError(msg) {
        document.getElementById('error-message').textContent = msg;
        openModal('error-modal');
    }

    // ── Card selection persistence ───────────────────────────────────────────
    const saveCards = () => localStorage.setItem('selectedCards', JSON.stringify(selectedCardIds));

    // Called once at startup. Uses creditCardsCache (already loaded) to seed defaults.
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

    function renderCardCheckboxes() {
        cardsContainer.innerHTML = '';
        creditCardsCache.forEach(card => {
            const id = String(card.id);
            const row = document.createElement('label');
            row.className = 'card-row';
            row.htmlFor = `cb-${id}`;

            const cb = document.createElement('input');
            cb.type      = 'checkbox';
            cb.id        = `cb-${id}`;
            cb.className = 'card-checkbox';
            cb.value     = id;
            cb.checked   = selectedCardIds.includes(id);
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    if (!selectedCardIds.includes(id)) selectedCardIds.push(id);
                } else {
                    selectedCardIds = selectedCardIds.filter(i => i !== id);
                }
                saveCards();
            });

            const label = document.createElement('span');
            label.className = 'card-label';
            label.textContent = card.card_name;

            row.appendChild(cb);
            row.appendChild(label);
            cardsContainer.appendChild(row);
        });
    }

    // Select / deselect all
    selectAllBtn.addEventListener('click', () => {
        const checkboxes  = cardsContainer.querySelectorAll('.card-checkbox');
        const allChecked  = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
            const id = cb.value;
            if (!allChecked && !selectedCardIds.includes(id)) selectedCardIds.push(id);
        });
        if (allChecked) selectedCardIds = [];
        selectAllBtn.textContent = allChecked ? 'Select all' : 'Deselect all';
        saveCards();
    });

    // ── Rewards dropdown ──────────────────────────────────────────────────────
    async function loadRewards() {
        const { data, error } = await sb
            .from('reward_types')
            .select('id, reward_type')
            .order('reward_type');
        if (error) { console.error('[CQ] loadRewards:', error); return; }

        const frag = document.createDocumentFragment();
        data.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.reward_type;
            frag.appendChild(opt);
        });
        categorySelect.appendChild(frag);
    }

    // Mutual exclusivity — using one input clears the other
    storeInput.addEventListener('input',     () => { categorySelect.value = ''; });
    categorySelect.addEventListener('change', () => { storeInput.value = ''; });

    // ── Show results ──────────────────────────────────────────────────────────
    function showResults(title, cards) {
        document.getElementById('results-title').textContent = title;
        const list = document.getElementById('results-list');
        list.innerHTML = '';

        if (!cards || cards.length === 0) {
            list.innerHTML = `<p class="results-empty">No rewards data found for your selected cards.<br>Open Settings and make sure you have cards selected.</p>`;
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

    // ── Card rewards lookup ───────────────────────────────────────────────────
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

    // ── Main search ───────────────────────────────────────────────────────────
    async function search() {
        const categoryId   = categorySelect.value;
        const storeName    = storeInput.value.trim();

        // Nothing entered
        if (!categoryId && !storeName) {
            showError('Please enter a store name or select a spending category.');
            return;
        }

        // Category selected — no extra DB round-trip needed, name is in the DOM
        if (categoryId) {
            const displayName = categorySelect.options[categorySelect.selectedIndex].text;
            await fetchCardRewards(categoryId, displayName);
            return;
        }

        // Store name search
        setLoading(true);
        try {
            const { data: stores, error } = await sb
                .from('stores')
                .select('id, store_name, reward_type_id')
                .ilike('store_name', `%${storeName}%`)
                .limit(30);

            if (error) throw error;

            if (stores.length === 0) {
                showError(`No stores found matching "${storeName}". Try a broader search or use the category dropdown.`);
                return;
            }

            if (stores.length === 1) {
                // Skip the picker if only one result
                await fetchCardRewards(stores[0].reward_type_id, stores[0].store_name);
                return;
            }

            // Multiple results — show picker
            const storeList = document.getElementById('store-list');
            storeList.innerHTML = '';
            stores.forEach(store => {
                const chip = document.createElement('button');
                chip.className   = 'store-chip';
                chip.textContent = store.store_name;
                chip.addEventListener('click', async () => {
                    closeAllModals();
                    await fetchCardRewards(store.reward_type_id, store.store_name);
                });
                storeList.appendChild(chip);
            });
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

    // ── Startup ───────────────────────────────────────────────────────────────
    // Single async init — loads cards (id + name) and rewards in parallel,
    // then seeds selectedCardIds. No redundant fetches anywhere.
    (async () => {
        try {
            const [cardsResult, _rewards] = await Promise.all([
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
