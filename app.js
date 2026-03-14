if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('service-worker.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.log('Service Worker Registration Failed:', err));
}

// Initialize Supabase client
const supabase = window.supabase.createClient(
    'https://yaqarscylnpmmbllfwxw.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFyc2N5bG5wbW1ibGxmd3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTQ5MDIsImV4cCI6MjA0Nzk3MDkwMn0.KuYXx8b-5MKDLmW6DfoG5lyMZPwFMROlbnDC-vJZDd8'
);

// Cache for credit cards — avoids re-fetching on every settings open
let creditCardsCache = null;

// DOM elements
const settingsBtn = document.getElementById('settings-btn');
const aboutBtn = document.getElementById('about-btn');
const contributeBtn = document.getElementById('contribute-btn');
const settingsModal = document.getElementById('settings-modal');
const aboutModal = document.getElementById('about-modal');
const contributeModal = document.getElementById('contribute-modal');
const closeSettingsModalButton = document.getElementById('settings-modal-close');
const closeAboutModalButton = document.getElementById('about-modal-close');
const closeContributeModalButton = document.getElementById('contribute-modal-close');
const selectedCardsContainer = document.getElementById('selected-cards-container');
const loadingSpinner = document.getElementById('loading-spinner');

// ─── Loading spinner helpers ───────────────────────────────────────────────
function showSpinner() {
    loadingSpinner.style.display = 'block';
}
function hideSpinner() {
    loadingSpinner.style.display = 'none';
}

// ─── Orientation check ─────────────────────────────────────────────────────
function checkOrientation() {
    const warning = document.getElementById('orientation-warning');
    warning.style.display = window.matchMedia('(orientation: portrait)').matches ? 'none' : 'flex';
}
window.addEventListener('orientationchange', checkOrientation);
checkOrientation();

// ─── Init ──────────────────────────────────────────────────────────────────
window.onload = async () => {
    // Wire up close buttons once at page load — no duplicate listeners
    document.getElementById('instruction-modal-close').onclick = () => {
        document.getElementById('instruction-modal').style.display = 'none';
    };
    document.getElementById('card-reward-modal-close').onclick = () => {
        document.getElementById('card-reward-modal').style.display = 'none';
    };
    document.getElementById('store-selection-modal-close').onclick = () => {
        document.getElementById('store-selection-modal').style.display = 'none';
    };

    // Load rewards dropdown
    await loadRewards();
    handleInputAndDropdown();

    // FIX: Initialize card selections on startup — not just when Settings opens.
    // If the user has never opened Settings, selectedCards in localStorage is null,
    // causing all card queries to run against an empty array and return nothing.
    await initializeCardSelections();
};

// Fetch all card IDs and default-select them all on first run.
// On subsequent visits, localStorage already has the user's saved selection.
async function initializeCardSelections() {
    const saved = localStorage.getItem('selectedCards');
    if (saved) {
        // User has a saved preference — load it into memory
        selectedCardIds = JSON.parse(saved);
        return;
    }
    // First run: fetch all cards and select them all by default
    try {
        const { data, error } = await supabase
            .from('credit_cards')
            .select('id');
        if (error) { console.error('Error initializing card selections:', error); return; }
        creditCardsCache = null; // will be populated with full names when settings opens
        selectedCardIds = data.map(c => String(c.id));
        saveSelectedCards();
    } catch (err) {
        console.error('Error initializing card selections:', err);
    }
}

// ─── Modal helpers ─────────────────────────────────────────────────────────
function closeAllModals() {
    [
        settingsModal,
        aboutModal,
        contributeModal,
        document.getElementById('instruction-modal'),
        document.getElementById('card-reward-modal'),
        document.getElementById('store-selection-modal'),
    ].forEach(m => { if (m) m.style.display = 'none'; });
}

function openModal(modal) {
    closeAllModals();
    modal.style.display = 'block';
}

// ─── Nav modal triggers ────────────────────────────────────────────────────
settingsBtn.addEventListener('click', () => {
    openModal(settingsModal);
    loadCreditCards();
});
aboutBtn.addEventListener('click', () => openModal(aboutModal));
contributeBtn.addEventListener('click', () => openModal(contributeModal));
closeSettingsModalButton.addEventListener('click', () => { settingsModal.style.display = 'none'; });
closeAboutModalButton.addEventListener('click', () => { aboutModal.style.display = 'none'; });
closeContributeModalButton.addEventListener('click', () => { contributeModal.style.display = 'none'; });

// ─── Settings: credit card checkboxes ──────────────────────────────────────
// selectedCardIds stores strings (checkbox.value) — kept as strings throughout
let selectedCardIds = [];

async function loadCreditCards() {
    // Use cache if available — skip the network round-trip
    if (creditCardsCache) {
        renderCardCheckboxes(creditCardsCache);
        loadSelectedCards();
        return;
    }
    try {
        const { data, error } = await supabase
            .from('credit_cards')
            .select('id, card_name')
            .order('card_name', { ascending: true });

        if (error) {
            console.error('Error fetching credit cards:', error);
            return;
        }
        creditCardsCache = data;
        renderCardCheckboxes(data);
        loadSelectedCards();
    } catch (error) {
        console.error('Error loading credit cards:', error);
    }
}

function renderCardCheckboxes(cards) {
    selectedCardsContainer.innerHTML = '';
    cards.forEach(card => {
        selectedCardsContainer.appendChild(createCardCheckbox(card));
    });
}

function createCardCheckbox(card) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `card-${card.id}`;
    checkbox.name = 'credit-card';
    checkbox.value = String(card.id); // always string
    checkbox.addEventListener('change', handleCardSelection);

    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);
    label.textContent = card.card_name;

    const container = document.createElement('div');
    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
}

document.getElementById('settings-select-all-button').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#selected-cards-container input[type="checkbox"]');
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => {
        cb.checked = !allSelected;
        const id = cb.value;
        if (!allSelected && !selectedCardIds.includes(id)) {
            selectedCardIds.push(id);
        } else if (allSelected) {
            selectedCardIds = selectedCardIds.filter(i => i !== id);
        }
    });

    document.getElementById('settings-select-all-button').textContent =
        allSelected ? 'Select All' : 'Deselect All';

    saveSelectedCards();
});

function handleCardSelection(event) {
    const id = event.target.value; // string
    if (event.target.checked) {
        if (!selectedCardIds.includes(id)) selectedCardIds.push(id);
    } else {
        selectedCardIds = selectedCardIds.filter(i => i !== id);
    }
    saveSelectedCards();
}

function saveSelectedCards() {
    localStorage.setItem('selectedCards', JSON.stringify(selectedCardIds));
}

function loadSelectedCards() {
    const saved = localStorage.getItem('selectedCards');

    if (saved) {
        selectedCardIds = JSON.parse(saved);
    } else {
        // Default: select all
        selectedCardIds = [];
        const checkboxes = document.querySelectorAll('#selected-cards-container input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            selectedCardIds.push(cb.value);
        });
        saveSelectedCards(); // only write when we're defaulting
        return;
    }

    // Reflect saved state in checkboxes
    selectedCardIds.forEach(id => {
        const cb = document.querySelector(`input[type="checkbox"][value="${id}"]`);
        if (cb) cb.checked = true;
    });
}

// ─── Rewards dropdown ──────────────────────────────────────────────────────
async function loadRewards() {
    try {
        const { data, error } = await supabase
            .from('reward_types')
            .select('id, reward_type')
            .order('reward_type', { ascending: true });

        if (error) {
            console.error('Error fetching reward categories:', error);
            return;
        }
        const dropdown = document.getElementById('reward-type');
        dropdown.innerHTML = '<option value="">Select a reward category</option>';
        data.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.reward_type;
            dropdown.appendChild(opt);
        });
    } catch (error) {
        console.error('Error loading rewards:', error);
    }
}

function handleInputAndDropdown() {
    const searchInput = document.getElementById('store-name');
    const rewardsDropdown = document.getElementById('reward-type');
    searchInput.addEventListener('input', () => { rewardsDropdown.value = ''; });
    rewardsDropdown.addEventListener('change', () => { searchInput.value = ''; });
}

// ─── Main search ───────────────────────────────────────────────────────────
async function findCardToUse() {
    const rewardDropdown = document.getElementById('reward-type');
    const selectedRewardId = rewardDropdown.value;
    const storeNameInput = document.getElementById('store-name').value.trim();

    if (!selectedRewardId && !storeNameInput) {
        document.getElementById('instruction').style.display = 'block';
        document.getElementById('instruction').innerHTML =
            '<p>Please select a reward category or enter a store name.</p>';
        openModal(document.getElementById('instruction-modal'));
        return;
    }

    showSpinner();

    try {
        if (selectedRewardId) {
            const { data: rewardData, error: rewardError } = await supabase
                .from('reward_types')
                .select('reward_type')
                .eq('id', selectedRewardId)
                .single();

            if (rewardError) throw rewardError;
            await cardRewardModal(selectedRewardId, rewardData.reward_type);

        } else {
            const { data: storesData, error: storesError } = await supabase
                .from('stores')
                .select('id, store_name, mcc_value, reward_type_id')
                .ilike('store_name', `%${storeNameInput}%`);

            if (storesError) throw storesError;

            const storeList = document.getElementById('store-list');

            if (storesData.length > 0) {
                storeList.innerHTML = '<h2>Please select a store to continue</h2>';
                storesData.forEach(store => {
                    const badge = document.createElement('span');
                    badge.className = 'badge';
                    badge.setAttribute('data-store-name', store.store_name);
                    badge.setAttribute('data-store-reward-id', store.reward_type_id);
                    badge.textContent = store.store_name;
                    badge.addEventListener('click', () => {
                        cardRewardModal(
                            badge.getAttribute('data-store-reward-id'),
                            badge.getAttribute('data-store-name')
                        );
                    });
                    storeList.appendChild(badge);
                });
            } else {
                storeList.innerHTML =
                    "<p>We couldn't find any stores matching your search. Try searching by Reward Category for better results.</p>";
            }

            openModal(document.getElementById('store-selection-modal'));
        }
    } catch (error) {
        console.error('Error in findCardToUse:', error);
    } finally {
        hideSpinner();
    }
}

// ─── Card reward modal ─────────────────────────────────────────────────────
async function cardRewardModal(rewardID, rewardStoreName) {
    // Normalize: rewardID from checkboxes is string; from DB it may be number
    const rewardIdNum = Number(rewardID);
    const savedCards = JSON.parse(localStorage.getItem('selectedCards')) || [];

    showSpinner();

    try {
        // FIX: filter by reward_type_id on the server, not in JS
        const { data, error } = await supabase
            .from('credit_card_reward_types')
            .select('credit_card_id, reward_type_id, multiplier, credit_cards(card_name)')
            .in('credit_card_id', savedCards)
            .eq('reward_type_id', rewardIdNum)          // server-side filter
            .order('multiplier', { ascending: false });

        if (error) throw error;

        document.getElementById('reward-category-store-name').textContent = rewardStoreName;
        const cardList = document.getElementById('card-list');
        cardList.innerHTML = '';

        if (data.length === 0) {
            cardList.innerHTML =
                '<p>Please select at least one credit card in the settings (top right) to view its multiplier value.</p>';
        } else {
            data.forEach(card => {
                const badge = document.createElement('div');
                badge.className = 'badge';
                badge.innerHTML = `
                    <span>${card.credit_cards.card_name}</span>
                    <span class="multiplier">${card.multiplier}x</span>
                `;
                cardList.appendChild(badge);
            });
        }

        openModal(document.getElementById('card-reward-modal'));
    } catch (error) {
        console.error('Error fetching data from database:', error);
    } finally {
        hideSpinner();
    }
}

// ─── Event listeners ───────────────────────────────────────────────────────
document.getElementById('search-button').addEventListener('click', findCardToUse);
document.getElementById('reward-type').addEventListener('keypress', e => {
    if (e.key === 'Enter') findCardToUse();
});
document.getElementById('store-name').addEventListener('keypress', e => {
    if (e.key === 'Enter') findCardToUse();
});
