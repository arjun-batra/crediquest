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
    // Check if the device is in portrait orientation
    if (window.matchMedia("(orientation: portrait)").matches) {
        // Portrait mode - hide the warning
        document.getElementById("orientation-warning").style.display = "none";
    } else {
        // Landscape mode - show the warning
        document.getElementById("orientation-warning").style.display = "flex";
    }
}
// Listen for orientation changes
window.addEventListener("orientationchange", checkOrientation);
// Initial check on page load
checkOrientation();
// Functions to load when window loads
window.onload = () => {
    loadRewards(); // Call function to load rewards
    handleInputAndDropdown(); // Call function to handle input and dropdown interaction
};

// Initialize Supabase client
const supabase = window.supabase.createClient('https://yaqarscylnpmmbllfwxw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFyc2N5bG5wbW1ibGxmd3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzOTQ5MDIsImV4cCI6MjA0Nzk3MDkwMn0.KuYXx8b-5MKDLmW6DfoG5lyMZPwFMROlbnDC-vJZDd8');

// Functionality to handle navigation modals.
// Function to close any currently open modal
function closeAllModals() {
    settingsModal.style.display = 'none';
    aboutModal.style.display = 'none';
    contributeModal.style.display = 'none';
    document.getElementById('instruction-modal').style.display = 'none';
    document.getElementById('card-reward-modal').style.display = 'none';
    document.getElementById('store-selection-modal').style.display = 'none';
}
// Function to open the Settings Modal
settingsBtn.addEventListener('click', () => {
    closeAllModals(); // Close all modals first
    settingsModal.style.display = 'block';
    loadCreditCards();
});
// Function to open the About Modal
aboutBtn.addEventListener('click', () => {
    closeAllModals(); // Close all modals first
    aboutModal.style.display = 'block';
});
// Function to open the Contribute Modal
contributeBtn.addEventListener('click', () => {
    closeAllModals(); // Close all modals first
    contributeModal.style.display = 'block';
});
// Function to close the Settings Modal
closeSettingsModalButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});
// Function to close the About Modal
closeAboutModalButton.addEventListener('click', () => {
    aboutModal.style.display = 'none';
});
// Function to close the Contribute Modal
closeContributeModalButton.addEventListener('click', () => {
    contributeModal.style.display = 'none';
});

//Loading of cards in Settings modal
// Array to store selected card IDs
let selectedCardIds = [];
// Function to fetch and display credit cards as checkboxes in settings modal
async function loadCreditCards() {
    try {
        // Fetch credit cards from the 'credit_cards' table in Supabase
        const { data, error } = await supabase
            .from('credit_cards')
            .select('id, card_name')
            .order('card_name', {ascending:true});

        if (error) {
            console.error('Error fetching credit cards:', error);
            return;
        }
        // Clear existing checkboxes inside the selectedCardsContainer
        selectedCardsContainer.innerHTML = '';
        // Create and append checkboxes for each credit card
        data.forEach(card => {
            const cardContainer = createCardCheckbox(card);
            selectedCardsContainer.appendChild(cardContainer);
        });
        // Now that checkboxes are rendered, load saved selections
        loadSelectedCards();
    } catch (error) {
        console.error('Error loading credit cards:', error);
    }
}
// Create a checkbox for each credit card
function createCardCheckbox(card) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `card-${card.id}`;
    checkbox.name = 'credit-card';
    checkbox.value = card.id;
    // Attach an event listener to handle checkbox selection/deselection
    checkbox.addEventListener('change', handleCardSelection);
    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);
    label.textContent = card.card_name;
    const cardContainer = document.createElement('div');
    cardContainer.appendChild(checkbox);
    cardContainer.appendChild(label);
    return cardContainer;
}
// Add a Select/Deselect All Button Handler
document.getElementById('settings-select-all-button').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#selected-cards-container input[type="checkbox"]');
    const allSelected = Array.from(checkboxes).every(checkbox => checkbox.checked);
    
    // Toggle checkboxes and selected card IDs
    checkboxes.forEach((checkbox) => {
        checkbox.checked = !allSelected;
        const cardId = checkbox.value;

        if (!allSelected && !selectedCardIds.includes(cardId)) {
            selectedCardIds.push(cardId);
        } else if (allSelected) {
            selectedCardIds = selectedCardIds.filter(id => id !== cardId);
        }
    });
    // Update button text
    const selectAllButton = document.getElementById('settings-select-all-button');
    selectAllButton.textContent = allSelected ? 'Select All' : 'Deselect All';
    saveSelectedCards();
});
// Handling selection or deselection of credit card
function handleCardSelection(event) {
    const cardId = event.target.value;
    if (event.target.checked) {
        // Add card ID to selectedCardIds array if checked
        selectedCardIds.push(cardId);
    } else {
        // Remove card ID from selectedCardIds array if unchecked
        selectedCardIds = selectedCardIds.filter(id => id !== cardId);
    }
    // Save the updated selection to local storage
    saveSelectedCards();
}
// Save selected cards to local storage
function saveSelectedCards() {
    localStorage.setItem('selectedCards', JSON.stringify(selectedCardIds)); 
}
// Retrieve Saved Cards on Page Load
function loadSelectedCards() {
    const savedCards = localStorage.getItem('selectedCards');
    
    if (savedCards) {
        // If there are saved cards, load them
        selectedCardIds = JSON.parse(savedCards);
    } else {
        // If no saved cards exist, select all cards by default
        selectedCardIds = []; // Clear any previous selections
        const checkboxes = document.querySelectorAll('#selected-cards-container input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true; // Check all checkboxes
            selectedCardIds.push(checkbox.value); // Add all card IDs to the selectedCardIds array
        });
    }
    
    // Ensure checkboxes are updated to reflect the saved selections or default selection
    selectedCardIds.forEach(cardId => {
        const checkbox = document.querySelector(`input[type="checkbox"][value="${cardId}"]`);
        if (checkbox) {
            checkbox.checked = true;
        } else {
            console.log(`Checkbox for card ${cardId} not found.`);
        }
    });
    
    // Save the selected cards to local storage
    saveSelectedCards();
}

// Function to fetch and display reward-types in drop-down
async function loadRewards() {
    try {
        // Fetch reward types from the 'rewards' table in Supabase (or any relevant table)
        const { data, error } = await supabase
            .from('reward_types')
            .select('id, reward_type')
            .order('reward_type', {ascending: true});
        if (error) {
            console.error('Error fetching reward categories:', error);
            return;
        }
        // Get the rewards dropdown element
        const rewardsDropdown = document.getElementById('reward-type');
        // Clear any existing options in the dropdown
        rewardsDropdown.innerHTML = '<option value="">Select a reward category</option>';
        // Populate the dropdown with the fetched rewards
        data.forEach(reward => {
            const option = document.createElement('option');
            option.value = reward.id;  // Set the reward id as the value
            option.textContent = reward.reward_type;  // Display the reward name in the dropdown
            rewardsDropdown.appendChild(option);  // Append the option to the dropdown
        });
    } catch (error) {
        console.error('Error loading rewards:', error);
    }
}

// Function to handle input and dropdown interaction
function handleInputAndDropdown() {
    const searchInput = document.getElementById('store-name');
    const rewardsDropdown = document.getElementById('reward-type');
    // Event listener for when the user types in the text input
    searchInput.addEventListener('input', () => {
        // Reset the rewards dropdown to default value when user starts typing
        rewardsDropdown.value = ''; // Set dropdown to default "Select a reward category"
    });
    // Event listener for when the user selects an option from the dropdown
    rewardsDropdown.addEventListener('change', () => {
        // Reset the text input to default when user selects from the dropdown
        searchInput.value = ''; // Set text input to empty
    });
}

// Function for Find Card to Use button
async function findCardToUse() {
    // Get the selected reward type from the dropdown and store name
    const rewardDropdown = document.getElementById('reward-type');
    const selectedRewardId = rewardDropdown.value;
    const storeNameInput = document.getElementById('store-name').value.trim();
    // Check if both reward type and store name are empty
    if (!selectedRewardId && !storeNameInput) {
        // Get instruction section
        const instructionSection = document.getElementById('instruction');
        // Show the instruction message
        instructionSection.style.display = 'block';
        instructionSection.innerHTML = '<p>Please select a reward category or enter a store name.</p>';  // User needs to select reward category or enter a store name
        closeAllModals(); // Close all modals first
        // Display the modal
        document.getElementById('instruction-modal').style.display = 'block';
        // Close the modal when the user clicks the close button
        document.getElementById('instruction-modal-close').addEventListener('click', () => {
            document.getElementById('instruction-modal').style.display = 'none';
        });
        return;
    }
    if(selectedRewardId){
        try {
            // Get the reward category name from the 'reward_types' table
            const { data: rewardData, error: rewardError } = await supabase
                .from('reward_types')
                .select('reward_type')
                .eq('id', selectedRewardId)
                .single(); // Get a single result
            if (rewardError) {
                console.error('Error fetching reward category:', rewardError);
                return;
            }
            const rewardName = rewardData.reward_type;
            // Sending data to populate card reward modal
            cardRewardModal(selectedRewardId, rewardName);
        } catch (error) {
            console.error('Error fetching cards:', error);
        }        
    } else if (storeNameInput){
        try {
            // Fetch stores and related reward type info
            const { data: storesData, error: storesError } = await supabase
                .from('stores')
                .select('id, store_name, mcc_value, reward_type_id')
                .ilike('store_name', `%${storeNameInput}%`);
            if (storesError) throw new Error('Error fetching stores data');
            // Dynamically populate modal with store badges
            const storeList = document.getElementById('store-list');
            if (storesData.length>0){    
                storeList.innerHTML = '<h2>Please select a store to continue</h2>';
                storesData.forEach(store => {
                    // Create a badge for each store
                    const badge = document.createElement('span');
                    badge.className = 'badge'; // Reusing the 'badge' CSS class
                    badge.setAttribute('data-store-name', store.store_name); // Store the store name as a data attribute
                    badge.setAttribute('data-store-reward-id', store.reward_type_id); // Store the store reward_type_id as a data attribute
                    badge.textContent = store.store_name; // Store name as the badge text

                    // Add click event listener to each badge
                    badge.addEventListener('click', () => {
                        const selectedStoreName = badge.getAttribute('data-store-name');
                        const selectedStoreRewardId = badge.getAttribute('data-store-reward-id');
                        cardRewardModal(selectedStoreRewardId, selectedStoreName);
                    });

                    // Append the badge to the store list
                    storeList.appendChild(badge);
                });

                // Open the modal to show the store names
                document.getElementById('store-selection-modal').style.display = 'block';

                // Close modal on click of close button
                document.getElementById('store-selection-modal-close').addEventListener('click', () => {
                    document.getElementById('store-selection-modal').style.display = 'none';
                });                
            } else if (storesData.length===0){
                // Clear any existing content in instructions and add the new message
                storeList.innerHTML = '<p>We couldn’t find any stores matching your search. Try searching by Reward Category for better results.</p>';
                // Show the instruction message
                storeList.style.display = 'block';
                closeAllModals(); // Close all modals first
                // Open the modal to show the store names
                document.getElementById('store-selection-modal').style.display = 'block';
                // Close modal on click of close button
                document.getElementById('store-selection-modal-close').addEventListener('click', () => {
                    document.getElementById('store-selection-modal').style.display = 'none';
                }); 
                
            }
        } catch (error) {
            console.error('Error fetching cards:', error);
        }
    }

}

// Populate Card Reward Modal
async function cardRewardModal(rewardID, reward_store_name) {
    // Retrieve the saved card IDs from localStorage
    const savedCards = JSON.parse(localStorage.getItem('selectedCards')) || [];
    try {
        // Fetch the card details for all saved cards from the database
        const { data, error } = await supabase
            .from('credit_card_reward_types')
            .select('credit_card_id, reward_type_id, multiplier, credit_cards(card_name)')
            .in('credit_card_id', savedCards) // Fetch only the saved cards by their IDs
            .order('multiplier', { ascending: false });
        if (error) {
            console.error('Error fetching cards:', error);
            return;
        }
        // Update the modal with the reward category/store name
        document.getElementById('reward-category-store-name').textContent = reward_store_name;
        // Get the modal and list elements
        const cardList = document.getElementById('card-list');
        cardList.innerHTML = '';  // Clear any existing content in the list
        // Filter the cards based on the selected reward type and log their multiplier
        const cardsToUse = data.filter(card => card.reward_type_id === Number(rewardID));
        if (cardsToUse.length === 0) {
            cardList.innerHTML = '<p>Please select at least one credit card in the settings (top right) to view its multiplier value.</p>';  // User needs to select atleast one card 
            closeAllModals(); // Close all modals first
            // Display the modal
            document.getElementById('card-reward-modal').style.display = 'block';
            // Close the modal when the user clicks the close button
            document.getElementById('card-reward-modal-close').addEventListener('click', () => {
                document.getElementById('card-reward-modal').style.display = 'none';
            });   
            return;
        }
        // Add each card and its multiplier to the modal list
        cardsToUse.forEach(card => {
            const badge = document.createElement('div');
            badge.className = 'badge'; // Ensure CSS styles for badges are defined
            badge.innerHTML = `
                <span>${card.credit_cards.card_name}</span>
                <span class="multiplier">${card.multiplier}x</span>
            `;
            cardList.appendChild(badge);
        });        
        // Close all modals first
        closeAllModals();
        // Display the modal
        document.getElementById('card-reward-modal').style.display = 'block';
        // Close the modal when the user clicks the close button
        document.getElementById('card-reward-modal-close').addEventListener('click', () => {
            document.getElementById('card-reward-modal').style.display = 'none';
        });
    } catch (error) {
        console.error('Error fetching data from database:', error);
    }
}

// Add event listener to the 'Find Card to Use' button
document.getElementById('search-button').addEventListener('click', findCardToUse);

// Add event listener to trigger function when 'Enter' is pressed
document.getElementById('reward-type').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        findCardToUse();
    }
});

// Add event listener to trigger function when 'Enter' is pressed
document.getElementById('store-name').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        findCardToUse();
    }
});
