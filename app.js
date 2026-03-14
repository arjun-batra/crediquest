// ─── Service Worker ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('service-worker.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.log('Service Worker Registration Failed:', err));
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────
// Everything lives inside DOMContentLoaded so:
//  (a) the DOM is guaranteed ready before any getElementById call
//  (b) Supabase SDK has had time to execute from <head>
//  (c) a crash in one section cannot silently kill unrelated buttons
document.addEventListener('DOMContentLoaded', () => {

    // ── Supabase init (safe) ───────────────────────────────────────────────
    if (!window.supabase) {
        document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif;color:red;">Failed to load app — please check your connection and refresh.</p>';
        return;
    }
    const supabase = window.supabase.createClient(
        'https://yaqarscylnpmmbllfwxw.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFyc2N5bG5wbW1ibGxmd3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTQ5MDIsImV4cCI6MjA0Nzk3MDkwMn0.KuYXx8b-5MKDLmW6DfoG5lyMZPwFMROlbnDC-vJZDd8'
    );

    // ── State ──────────────────────────────────────────────────────────────
    let selectedCardIds = [];
    let creditCardsCache = null;

    // ── DOM refs ───────────────────────────────────────────────────────────
    const settingsBtn            = document.getElementById('settings-btn');
    const aboutBtn               = document.getElementById('about-btn');
    const contributeBtn          = document.getElementById('contribute-btn');
    const settingsModal          = document.getElementById('settings-modal');
    const aboutModal             = document.getElementById('about-modal');
    const contributeModal        = document.getElementById('contribute-modal');
    const selectedCardsContainer = document.getElementById('selected-cards-container');
    const loadingSpinner         = document.getElementById('loading-spinner');

    // ── Spinner ────────────────────────────────────────────────────────────
    function showSpinner() { loadingSpinner.style.display = 'block'; }
    function hideSpinner() { loadingSpinner.style.display = 'none'; }

    // ── Orientation ────────────────────────────────────────────────────────
    function checkOrientation() {
        const warning = document.getElementById('orientation-warning');
        if (warning) warning.style.display = window.matchMedia('(orientation: portrait)').matches ? 'none' : 'flex';
    }
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();

    // ── Modals ─────────────────────────────────────────────────────────────
    function closeAllModals() {
        ['settings-modal','about-modal','contribute-modal',
         'instruction-modal','card-reward-modal','store-selection-modal']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
    }

    function openModal(id) {
        closeAllModals();
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    }

    // Nav open
    settingsBtn.addEventListener('click', () => { openModal('settings-modal'); loadCreditCards(); });
    aboutBtn.addEventListener('click',    () => openModal('about-modal'));
    contributeBtn.addEventListener('click',() => openModal('contribute-modal'));

    // All close buttons
    document.getElementById('settings-modal-close').addEventListener('click',       () => { settingsModal.style.display = 'none'; });
    document.getElementById('about-modal-close').addEventListener('click',           () => { aboutModal.style.display = 'none'; });
    document.getElementById('contribute-modal-close').addEventListener('click',      () => { contributeModal.style.display = 'none'; });
    document.getElementById('instruction-modal-close').addEventListener('click',     () => { document.getElementById('instruction-modal').style.display = 'none'; });
    document.getElementById('card-reward-modal-close').addEventListener('click',     () => { document.getElementById('card-reward-modal').style.display = 'none'; });
    document.getElementById('store-selection-modal-close').addEventListener('click', () => { document.getElementById('store-selection-modal').style.display = 'none'; });

    // ── Card selection persistence ─────────────────────────────────────────
    function saveSelectedCards() {
        localStorage.setItem('selectedCards', JSON.stringify(selectedCardIds));
    }

    // Seed selectedCardIds from localStorage.
    // Treats a saved empty array the same as no preference (guards against old bug).
    async function initializeCardSelections() {
        const saved  = localStorage.getItem('selectedCards');
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed && parsed.length > 0) {
            selectedCardIds = parsed;
            return;
        }
        try {
            const { data, error } = await supabase.from('credit_cards').select('id');
            if (error) throw error;
            selectedCardIds = data.map(c => String(c.id));
            saveSelectedCards();
        } catch (err) {
            console.error('Error initializing card selections:', err);
        }
    }

    function handleCardSelection(event) {
        const id = event.target.value;
        if (event.target.checked) {
            if (!selectedCardIds.includes(id)) selectedCardIds.push(id);
        } else {
            selectedCardIds = selectedCardIds.filter(i => i !== id);
        }
        saveSelectedCards();
    }

    function renderCardCheckboxes(cards) {
        selectedCardsContainer.innerHTML = '';
        cards.forEach(card => {
            const checkbox = document.createElement('input');
            checkbox.type    = 'checkbox';
            checkbox.id      = `card-${card.id}`;
            checkbox.name    = 'credit-card';
            checkbox.value   = String(card.id);
            checkbox.checked = selectedCardIds.includes(String(card.id));
            checkbox.addEventListener('change', handleCardSelection);

            const label = document.createElement('label');
            label.setAttribute('for', checkbox.id);
            label.textContent = card.card_name;

            const row = document.createElement('div');
            row.appendChild(checkbox);
            row.appendChild(label);
            selectedCardsContainer.appendChild(row);
        });
    }

    async function loadCreditCards() {
        if (creditCardsCache) { renderCardCheckboxes(creditCardsCache); return; }
        try {
            const { data, error } = await supabase
                .from('credit_cards')
                .select('id, card_name')
                .order('card_name', { ascending: true });
            if (error) throw error;
            creditCardsCache = data;
            renderCardCheckboxes(data);
        } catch (err) {
            console.error('Error loading credit cards:', err);
        }
    }

    document.getElementById('settings-select-all-button').addEventListener('click', () => {
        const checkboxes  = document.querySelectorAll('#selected-cards-container input[type="checkbox"]');
        const allSelected = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => {
            cb.checked = !allSelected;
            const id = cb.value;
            if (!allSelected && !selectedCardIds.includes(id)) selectedCardIds.push(id);
            else if (allSelected) selectedCardIds = selectedCardIds.filter(i => i !== id);
        });
        document.getElementById('settings-select-all-button').textContent = allSelected ? 'Select All' : 'Deselect All';
        saveSelectedCards();
    });

    // ── Rewards dropdown ───────────────────────────────────────────────────
    async function loadRewards() {
        try {
            const { data, error } = await supabase
                .from('reward_types')
                .select('id, reward_type')
                .order('reward_type', { ascending: true });
            if (error) throw error;
            const dropdown = document.getElementById('reward-type');
            dropdown.innerHTML = '<option value="">Select a reward category</option>';
            data.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.reward_type;
                dropdown.appendChild(opt);
            });
        } catch (err) {
            console.error('Error loading rewards:', err);
        }
    }

    // Mutual exclusivity: using one input clears the other
    document.getElementById('store-name').addEventListener('input',   () => { document.getElementById('reward-type').value = ''; });
    document.getElementById('reward-type').addEventListener('change',  () => { document.getElementById('store-name').value = ''; });

    // ── Card reward modal ──────────────────────────────────────────────────
    async function cardRewardModal(rewardID, rewardStoreName) {
        const rewardIdNum = Number(rewardID);

        if (selectedCardIds.length === 0) {
            document.getElementById('reward-category-store-name').textContent = rewardStoreName;
            document.getElementById('card-list').innerHTML = '<p>No cards selected. Open Settings and select at least one card.</p>';
            openModal('card-reward-modal');
            return;
        }

        showSpinner();
        try {
            const { data, error } = await supabase
                .from('credit_card_reward_types')
                .select('credit_card_id, multiplier, credit_cards(card_name)')
                .in('credit_card_id', selectedCardIds)
                .eq('reward_type_id', rewardIdNum)
                .order('multiplier', { ascending: false });
            if (error) throw error;

            document.getElementById('reward-category-store-name').textContent = rewardStoreName;
            const cardList = document.getElementById('card-list');
            cardList.innerHTML = '';

            if (data.length === 0) {
                cardList.innerHTML = '<p>No rewards data found for the selected cards and category.</p>';
            } else {
                data.forEach(card => {
                    const badge = document.createElement('div');
                    badge.className = 'badge';
                    badge.innerHTML = `<span>${card.credit_cards.card_name}</span><span class="multiplier">${card.multiplier}x</span>`;
                    cardList.appendChild(badge);
                });
            }
            openModal('card-reward-modal');
        } catch (err) {
            console.error('Error fetching card rewards:', err);
        } finally {
            hideSpinner();
        }
    }

    // ── Main search ────────────────────────────────────────────────────────
    async function findCardToUse() {
        const selectedRewardId = document.getElementById('reward-type').value;
        const storeNameInput   = document.getElementById('store-name').value.trim();

        if (!selectedRewardId && !storeNameInput) {
            document.getElementById('instruction').style.display = 'block';
            document.getElementById('instruction').innerHTML = '<p>Please select a reward category or enter a store name.</p>';
            openModal('instruction-modal');
            return;
        }

        showSpinner();
        try {
            if (selectedRewardId) {
                const { data, error } = await supabase
                    .from('reward_types')
                    .select('reward_type')
                    .eq('id', selectedRewardId)
                    .single();
                if (error) throw error;
                await cardRewardModal(selectedRewardId, data.reward_type);

            } else {
                const { data: stores, error } = await supabase
                    .from('stores')
                    .select('id, store_name, reward_type_id')
                    .ilike('store_name', `%${storeNameInput}%`);
                if (error) throw error;

                const storeList = document.getElementById('store-list');
                if (stores.length > 0) {
                    storeList.innerHTML = '<h2>Please select a store to continue</h2>';
                    stores.forEach(store => {
                        const badge = document.createElement('span');
                        badge.className = 'badge';
                        badge.textContent = store.store_name;
                        badge.addEventListener('click', () => cardRewardModal(store.reward_type_id, store.store_name));
                        storeList.appendChild(badge);
                    });
                } else {
                    storeList.innerHTML = '<p>No stores found. Try searching by Reward Category instead.</p>';
                }
                openModal('store-selection-modal');
            }
        } catch (err) {
            console.error('Error in findCardToUse:', err);
        } finally {
            hideSpinner();
        }
    }

    document.getElementById('search-button').addEventListener('click', findCardToUse);
    document.getElementById('reward-type').addEventListener('keypress', e => { if (e.key === 'Enter') findCardToUse(); });
    document.getElementById('store-name').addEventListener('keypress',  e => { if (e.key === 'Enter') findCardToUse(); });

    // ── Startup sequence ───────────────────────────────────────────────────
    (async () => {
        await initializeCardSelections();
        await loadRewards();
    })();

}); // end DOMContentLoaded
