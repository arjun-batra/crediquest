// Get DOM elements for store name input, reward type dropdown, search button, and modal elements
const storeInput = document.getElementById('store-name');
const rewardDropdown = document.getElementById('reward-type');
const searchButton = document.getElementById('search-button');
const loadingSpinner = document.getElementById('loading-spinner');
const cardDisplayContainer = document.getElementById('card-display-container');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const closeModalButton = document.querySelector('.close-modal');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsModalClose = document.getElementById('settings-modal-close');
const selectedCardsContainer = document.getElementById('selected-cards-container');

// Initialize Supabase client
const supabase = window.supabase.createClient('https://yaqarscylnpmmbllfwxw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFyc2N5bG5wbW1ibGxmd3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTQ5MDIsImV4cCI6MjA0Nzk3MDkwMn0.KuYXx8b-5MKDLmW6DfoG5lyMZPwFMROlbnDC-vJZDd8');

// Load reward types in drop-down
async function loadRewardTypes() {
    try {
        const { data, error } = await supabase
            .from('reward_types')
            .select('id, reward_type')
            .order('reward_type',{ascending: true});

        if (error) {
            console.error("Error fetching reward types:", error);
            return;
        }

        const rewardDropdown = document.getElementById('reward-type');
        rewardDropdown.innerHTML = '<option value="">Select a reward type</option>'; // Reset options

        data.forEach(rewardType => {
            const option = document.createElement('option');
            option.value = rewardType.id;
            option.textContent = rewardType.reward_type;
            rewardDropdown.appendChild(option);
        });
        // Console message if reward type load is successful
        //console.log("Reward types loaded:", data);
    } catch (err) {
        console.error("Unexpected error fetching reward types:", err);
    }
}


// Function to fetch credit cards linked to a reward type or store name
async function fetchCreditCards(storeName = '', rewardTypeId = '') {
    try {
        loadingSpinner.style.display = 'block'; // Show loading spinner

        // Query based on either store name or reward type
        let query = supabase
            .from('credit_cards')
            .select('id, name, multiplier')
            .eq('reward_type_id', rewardTypeId);

        if (storeName) {
            query = query.ilike('store_name', `%${storeName}%`); // Partial match for store name
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data.length === 0) {
            alert('No cards found for the given search criteria.');
        }

        // Clear any previous search results
        cardDisplayContainer.innerHTML = '';

        // Display the results in the modal
        data.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card');
            cardElement.innerHTML = `<h3>${card.name}</h3><p>Multiplier: ${card.multiplier}</p>`;
            cardDisplayContainer.appendChild(cardElement);
        });

        loadingSpinner.style.display = 'none'; // Hide loading spinner
    } catch (error) {
        console.error('Error fetching credit cards:', error);
        loadingSpinner.style.display = 'none'; // Hide loading spinner
    }
}

// Function to handle search button click or Enter key press
async function handleSearch() {
    const storeName = storeInput.value.trim();
    const rewardType = rewardDropdown.value.trim();

    if (storeName === "" && rewardType === "") {
        alert("Please enter a store name or select a reward type.");
        return;
    }

    try {
        // Step 1: Search for stores based on store name (using partial match for case-insensitive search)
        let storeQuery = supabase.from('stores').select('id, store_name, mcc_value');

        if (storeName) {
            storeQuery = storeQuery.ilike('store_name', `%${storeName}%`);
        }

        const { data: storesData, error: storeError } = await storeQuery;

        if (storeError) {
            console.error("Error fetching stores:", storeError);
            alert("Failed to retrieve stores.");
            return;
        }

        if (!storesData || storesData.length === 0) {
            alert("No stores found.");
            return;
        }

        // Step 2: Display list of matching stores for user to select from
        const storeList = storesData.map(store => store.store_name).join("\n");
        const selectedStore = prompt(`Matching stores:\n\n${storeList}\n\nPlease select a store:`);
        if (!selectedStore) {
            alert("No store selected.");
            return;
        }

        // Find the selected store's data
        const selectedStoreData = storesData.find(store => store.store_name === selectedStore);
        if (!selectedStoreData) {
            alert("Store not found in the list.");
            return;
        }

        // Step 3: Use the mcc_value to find associated reward_type_ids in reward_type_mcc table
        const { data: rewardTypeMccData, error: rewardTypeMccError } = await supabase
            .from('reward_type_mcc')
            .select('reward_type_id')
            .eq('mcc_value', selectedStoreData.mcc_value); // Filter based on selected store's mcc_value

        if (rewardTypeMccError) {
            console.error("Error fetching reward types:", rewardTypeMccError);
            alert("Failed to retrieve reward types.");
            return;
        }

        const rewardTypeIds = rewardTypeMccData.map(item => item.reward_type_id);

        // Step 4: If a reward type was selected, filter by reward type name
        let rewardTypesQuery = supabase.from('reward_types').select('id, reward_type');
        if (rewardType) {
            rewardTypesQuery = rewardTypesQuery.ilike('reward_type', `%${rewardType}%`);
        }
        const { data: rewardTypesData, error: rewardTypesError } = await rewardTypesQuery;

        if (rewardTypesError) {
            console.error("Error fetching reward types:", rewardTypesError);
            alert("Failed to retrieve reward type details.");
            return;
        }

        // Filter reward types based on the mcc_value association
        const rewardTypeIdsFiltered = rewardTypesData
            .filter(rt => rewardTypeIds.includes(rt.id)) // Only keep matching reward types
            .map(rt => rt.id);

        // If no reward type was selected, use all the found rewardTypeIds
        const rewardTypeIdsFinal = rewardType ? rewardTypeIdsFiltered : rewardTypeIds;

        // Step 5: Fetch credit card reward types for the filtered reward type IDs
        const { data: creditCardRewardTypes, error: ccRewardError } = await supabase
            .from('credit_card_reward_types')
            .select('multiplier, credit_card_id, reward_type_id')
            .in('reward_type_id', rewardTypeIdsFinal);

        if (ccRewardError) {
            console.error("Error fetching credit card reward types:", ccRewardError);
            alert("Failed to retrieve credit card reward types.");
            return;
        }

        const creditCardIds = creditCardRewardTypes.map(ccr => ccr.credit_card_id);

        // Step 6: Fetch card names for the associated credit card IDs
        const { data: creditCardsData, error: creditCardsError } = await supabase
            .from('credit_cards')
            .select('id, card_name')
            .in('id', creditCardIds);

        if (creditCardsError) {
            console.error("Error fetching credit card names:", creditCardsError);
            alert("Failed to retrieve credit cards.");
            return;
        }

        // Combine all results
        const results = creditCardRewardTypes.map(ccReward => {
            const card = creditCardsData.find(cc => cc.id === ccReward.credit_card_id);
            const reward = rewardTypesData.find(rt => rt.id === ccReward.reward_type_id);

            return {
                card_name: card ? card.card_name : 'Unknown Card',
                reward_type: reward ? reward.reward_type : 'Unknown Reward Type',
                multiplier: ccReward.multiplier,
            };
        });

        // Sort results by multiplier in descending order
        results.sort((a, b) => b.multiplier - a.multiplier);

        // Display results (customize as needed)
        if (results.length > 0) {
            console.log("Search results:", results);
            alert(JSON.stringify(results, null, 2)); // Replace this with actual display logic
        } else {
            alert("No matching results found.");
        }
    } catch (err) {
        console.error("Unexpected error during search:", err);
        alert("An unexpected error occurred. Please try again.");
    }

    // Clear inputs after search (optional)
    storeInput.value = "";
    rewardDropdown.value = "";
}





// Add event listener for search button click
searchButton.addEventListener('click', handleSearch);

// Allow user to press "Enter" to trigger search
storeInput.addEventListener('keypress', (e) => {
    if (e.key === "Enter") {
        handleSearch();
    }
});

rewardDropdown.addEventListener('keypress', (e) => {
    if (e.key === "Enter") {
        handleSearch();
    }
});

// Function to toggle modal visibility
function toggleModal() {
    modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
}

// Function to open settings modal
function openSettingsModal() {
    settingsModal.style.display = 'block';
}

// Event listener to open settings modal when settings button is clicked
settingsBtn.addEventListener('click', openSettingsModal);

// Close modal when the close button is clicked
closeModalButton.addEventListener('click', toggleModal);

// Close settings modal when the close button is clicked
settingsModalClose.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

// Function to populate settings modal with selected cards (checkboxes)
async function fetchUserCards() {
    try {
        const { data, error } = await supabase
            .from('credit_cards')
            .select('*');

        if (error) throw error;

        selectedCardsContainer.innerHTML = ''; // Clear existing checkboxes

        // Create checkboxes for each card
        data.forEach(card => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `card-${card.id}`;
            checkbox.value = card.id;
            checkbox.classList.add('card-checkbox');
            const label = document.createElement('label');
            label.setAttribute('for', `card-${card.id}`);
            label.textContent = card.name;
            selectedCardsContainer.appendChild(checkbox);
            selectedCardsContainer.appendChild(label);
            selectedCardsContainer.appendChild(document.createElement('br'));
        });
    } catch (error) {
        console.error('Error fetching user cards:', error);
    }
}

// Fetch reward types when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadRewardTypes();
    await fetchUserCards(); // Fetch user cards for settings modal
});
