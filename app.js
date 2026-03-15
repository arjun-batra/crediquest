if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('service-worker.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.log('Service Worker Registration Failed:', err));
}


// Get DOM elements for store name input, reward type dropdown, search button, and modal elements
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

// Screen orientation warning
function checkOrientation() {
    if (window.matchMedia("(orientation: portrait)").matches) {
        document.getElementById("orientation-warning").style.display = "none";
    } else {
        document.getElementById("orientation-warning").style.display = "flex";
    }
}
window.addEventListener("orientationchange", checkOrientation);
checkOrientation();

window.onload = () => {
    loadRewards();
    handleInputAndDropdown();
};

// Initialize Supabase client
const supabase = window.supabase.createClient('https://yaqarscylnpmmbllfwxw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFyc2N5bG5wbW1ibGxmd3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTQ5MDIsImV4cCI6MjA0Nzk3MDkwMn0.KuYXx8b-5MKDLmW6DfoG5lyMZPwFMROlbnDC-vJZDd8');

// Functionality to handle navigation modals.
function closeAllModals() {
    settingsModal.style.display = 'none';
    aboutModal.style.display = 'none';
    contributeModal.style.display = 'none';
    document.getElementById('instruction-modal').style.display = 'none';
    document.getElementById('card-reward-modal').style.display = 'none';
    document.getElementById('store-selection-modal').style.display = 'none';
}

settingsBtn.addEventListener('click', () => {
    closeAllModals();
    settingsModal.style.display = 'block';
    loadCreditCards();
});
aboutBtn.addEventListener('click', () => {
    closeAllModals();
    aboutModal.style.display = 'block';
});
contributeBtn.addEventListener('click', () => {
    closeAllModals();
    contributeModal.style.display = 'block';
});
closeSettingsModalButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});
closeAboutModalButton.addEventListener('click', () => {
    aboutModal.style.display = 'none';
});
closeContributeModalButton.addEventListener('click', () => {
    contributeModal.style.display = 'none';
});

// Close buttons for result modals wired once at startup — avoids duplicate
// listener accumulation that occurs when they are wired inside functions that
// run on every search.
document.getElementById('instruction-modal-close').onclick = () => {
    document.getElementById('instruction-modal').style.display = 'none';
};
document.getElementById('card-reward-modal-close').onclick = () => {
    document.getElementById('card-reward-modal').style.display = 'none';
};
document.getElementById('store-selection-modal-close').onclick = () => {
    document.getElementById('store-selection-modal').style.display = 'none';
};

// Loading of cards in Settings modal
let selectedCardIds = [];

async function loadCreditCards() {
    try {
        const { data, error } = await supabase
            .from('credit_cards')
            .select('id, card_name')
            .order('card_name', { ascending: true });

        if (error) {
            console.error('Error fetching credit cards:', error);
            return;
        }
        selectedCardsContainer.innerHTML = '';
        data.forEach(card => {
            const cardContainer = createCardCheckbox(card);
            selectedCardsContainer.appendChild(cardContainer);
        });
        loadSelectedCards();
    } catch (error) {
        console.error('Error loading credit cards:', error);
    }
}

function createCardCheckbox(card) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `card-${card.id}`;
    checkbox.name = 'credit-card';
    checkbox.value = card.id;
    checkbox.addEventListener('change', handleCardSelection);

    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);
    label.textContent = card.card_name;

    const cardContainer = document.createElement('div');
    cardContainer.appendChild(checkbox);
    cardContainer.appendChild(label);
    return cardContainer;
}

document.getElementById('settings-select-all-button').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#selected-cards-container input[type="checkbox"]');
    const allSelected = Array.from(checkboxes).every(checkbox => checkbox.checked);

    checkboxes.forEach((checkbox) => {
        checkbox.checked = !allSelected;
        const cardId = checkbox.value;
        if (!allSelected && !selectedCardIds.includes(cardId)) {
            selectedCardIds.push(cardId);
        } else if (allSelected) {
            selectedCardIds = selectedCardIds.filter(id => id !== cardId);
        }
    });

    const selectAllButton = document.getElementById('settings-select-all-button');
    selectAllButton.textContent = allSelected ? 'Select All' : 'Deselect All';
    saveSelectedCards();
});

function handleCardSelection(event) {
    const cardId = event.target.value;
    if (event.target.checked) {
        selectedCardIds.push(cardId);
    } else {
        selectedCardIds = selectedCardIds.filter(id => id !== cardId);
    }
    saveSelectedCards();
}

function saveSelectedCards() {
    localStorage.setItem('selectedCards', JSON.stringify(selectedCardIds));
}

function loadSelectedCards() {
    const savedCards = localStorage.getItem('selectedCards');

    if (savedCards) {
        selectedCardIds = JSON.parse(savedCards);
    } else {
        // No saved preference — select all by default
        selectedCardIds = [];
        const checkboxes = document.querySelectorAll('#selected-cards-container input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedCardIds.push(checkbox.value);
        });
        saveSelectedCards(); // Only save when we're setting defaults, not on every load
    }

    // Reflect saved selections in the UI
    selectedCardIds.forEach(cardId => {
        const checkbox = document.querySelector(`input[type="checkbox"][value="${cardId}"]`);
        if (checkbox) checkbox.checked = true;
    });
}

// Function to fetch and display reward-types in drop-down
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

        const rewardsDropdown = document.getElementById('reward-type');
        rewardsDropdown.innerHTML = '<option value="">Select a reward category</option>';
        data.forEach(reward => {
            const option = document.createElement('option');
            option.value = reward.id;
            option.textContent = reward.reward_type;
            rewardsDropdown.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading rewards:', error);
    }
}

function handleInputAndDropdown() {
    const searchInput = document.getElementById('store-name');
    const rewardsDropdown = document.getElementById('reward-type');

    searchInput.addEventListener('input', () => {
        rewardsDropdown.value = '';
    });
    rewardsDropdown.addEventListener('change', () => {
        searchInput.value = '';
    });
}

// Function for Find Card to Use button
async function findCardToUse() {
    const rewardDropdown = document.getElementById('reward-type');
    const selectedRewardId = rewardDropdown.value;
    const storeNameInput = document.getElementById('store-name').value.trim();

    if (!selectedRewardId && !storeNameInput) {
        const instructionSection = document.getElementById('instruction');
        instructionSection.style.display = 'block';
        instructionSection.innerHTML = '<p>Please select a reward category or enter a store name.</p>';
        closeAllModals();
        document.getElementById('instruction-modal').style.display = 'block';
        return;
    }

    if (selectedRewardId) {
        try {
            const { data: rewardData, error: rewardError } = await supabase
                .from('reward_types')
                .select('reward_type')
                .eq('id', selectedRewardId)
                .single();

            if (rewardError) {
                console.error('Error fetching reward category:', rewardError);
                return;
            }
            // Category search — storeId is null, no store override lookup fires
            cardRewardModal(selectedRewardId, rewardData.reward_type, null);
        } catch (error) {
            console.error('Error fetching cards:', error);
        }

    } else if (storeNameInput) {
        try {
            const { data: storesData, error: storesError } = await supabase
                .from('stores')
                .select('id, store_name, mcc_value, reward_type_id')
                .ilike('store_name', `%${storeNameInput}%`);

            if (storesError) throw new Error('Error fetching stores data');

            const storeList = document.getElementById('store-list');

            if (storesData.length > 0) {
                storeList.innerHTML = '<h2>Please select a store to continue</h2>';
                storesData.forEach(store => {
                    const badge = document.createElement('span');
                    badge.className = 'badge';
                    badge.setAttribute('data-store-name', store.store_name);
                    badge.setAttribute('data-store-reward-id', store.reward_type_id);
                    // Pass store id so override lookup can match on the specific store
                    badge.setAttribute('data-store-id', store.id);
                    badge.textContent = store.store_name;

                    badge.addEventListener('click', () => {
                        cardRewardModal(
                            badge.getAttribute('data-store-reward-id'),
                            badge.getAttribute('data-store-name'),
                            badge.getAttribute('data-store-id')
                        );
                    });

                    storeList.appendChild(badge);
                });

                document.getElementById('store-selection-modal').style.display = 'block';

            } else {
                storeList.innerHTML = '<p>We couldn\'t find any stores matching your search. Try searching by Reward Category for better results.</p>';
                storeList.style.display = 'block';
                closeAllModals();
                document.getElementById('store-selection-modal').style.display = 'block';
            }
        } catch (error) {
            console.error('Error fetching cards:', error);
        }
    }
}

// Populate Card Reward Modal
// storeId = null  → category search, no override lookup
// storeId = set   → specific store selected, override lookup fires and wins
//                   over category rate for any matching card+store pair
async function cardRewardModal(rewardID, reward_store_name, storeId = null) {
    const savedCards = JSON.parse(localStorage.getItem('selectedCards')) || [];

    try {
        // Step 1: category-level multipliers for all saved cards
        const { data, error } = await supabase
            .from('credit_card_reward_types')
            .select('credit_card_id, reward_type_id, multiplier, credit_cards(card_name)')
            .in('credit_card_id', savedCards)
            .order('multiplier', { ascending: false });

        if (error) {
            console.error('Error fetching cards:', error);
            return;
        }

        // Step 2: store-level overrides — only when a specific store was selected
        let overridesByCardId = {};
        if (storeId) {
            const { data: overrideData, error: overrideError } = await supabase
                .from('credit_card_store_overrides')
                .select('credit_card_id, multiplier')
                .eq('store_id', storeId)
                .in('credit_card_id', savedCards);

            if (overrideError) {
                console.error('Error fetching store overrides:', overrideError);
                // Non-fatal: fall through and show category multipliers
            } else if (overrideData) {
                overrideData.forEach(o => {
                    overridesByCardId[o.credit_card_id] = o.multiplier;
                });
            }
        }

        document.getElementById('reward-category-store-name').textContent = reward_store_name;
        const cardList = document.getElementById('card-list');
        cardList.innerHTML = '';

        const cardsToUse = data.filter(card => card.reward_type_id === Number(rewardID));

        if (cardsToUse.length === 0) {
            cardList.innerHTML = '<p>Please select at least one credit card in the settings (top right) to view its multiplier value.</p>';
            closeAllModals();
            document.getElementById('card-reward-modal').style.display = 'block';
            return;
        }

        // Step 3: merge — store override wins over category rate where present
        const mergedCards = cardsToUse.map(card => {
            const override = overridesByCardId[card.credit_card_id];
            return {
                cardName: card.credit_cards.card_name,
                multiplier: override !== undefined ? override : card.multiplier,
                isOverride: override !== undefined
            };
        });

        mergedCards.sort((a, b) => b.multiplier - a.multiplier);

        mergedCards.forEach(card => {
            const badge = document.createElement('div');
            badge.className = 'badge';
            badge.innerHTML = `
                <span>${card.cardName}</span>
                <span class="multiplier">
                    ${card.multiplier}x
                    ${card.isOverride ? '<span class="override-tag">store rate</span>' : ''}
                </span>
            `;
            cardList.appendChild(badge);
        });

        closeAllModals();
        document.getElementById('card-reward-modal').style.display = 'block';

    } catch (error) {
        console.error('Error fetching data from database:', error);
    }
}

// Add event listener to the 'Find Card to Use' button
document.getElementById('search-button').addEventListener('click', findCardToUse);

document.getElementById('reward-type').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') findCardToUse();
});

document.getElementById('store-name').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') findCardToUse();
});
