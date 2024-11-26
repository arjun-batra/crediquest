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
    console.log(allSelected ? 'All checkboxes deselected.' : 'All checkboxes selected.');
    console.log('Updated Selected Cards:', selectedCardIds);
    saveSelectedCards();
    console.log('Selected Cards:', selectedCardIds);
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
    console.log('Selected Cards:', selectedCardIds);
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
        console.log('Saved Selected Cards:', selectedCardIds);
    } else {
        // If no saved cards exist, select all cards by default
        console.log('No saved cards found. Selecting all cards by default.');
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

// Function to find and log the saved cards associated with the selected reward type
async function findCardToUse() {
    // Get the selected reward type from the dropdown
    const rewardDropdown = document.getElementById('reward-type');
    const selectedRewardId = rewardDropdown.value;
    // Check if a reward type is selected
    if (!selectedRewardId) {
        console.log('Please select a reward type.');
        return;
    }
    // Retrieve the saved card IDs from localStorage
    const savedCards = JSON.parse(localStorage.getItem('selectedCards')) || [];
    
    /*if (savedCards.length === 0) {
        console.log('No cards saved.');
        return;
    }*/
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
        // Get instruction section
        const instructionSection = document.getElementById('card-reward-instruction');
        instructionSection.style.display = 'none';
        // Get the modal and list elements
        const cardList = document.getElementById('card-list');
        cardList.innerHTML = '';  // Clear any existing content in the list
        // Update the modal with the reward category name
        document.getElementById('reward-category-name').textContent = rewardData.reward_type;
        // Filter the cards based on the selected reward type and log their multiplier
        const cardsToUse = data.filter(card => card.reward_type_id === Number(selectedRewardId));
        if (cardsToUse.length === 0) {
            console.log('No saved cards associated with this reward type.');
            //
            // Show the instruction message
            instructionSection.style.display = 'block';
            // Get the modal and instructions
            document.getElementById('card-reward-instruction');
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
            const listItem = document.createElement('li');
            listItem.textContent = `${card.credit_cards.card_name} - Multiplier: ${card.multiplier}`;
            cardList.appendChild(listItem);
        });
        closeAllModals(); // Close all modals first
        // Display the modal
        document.getElementById('card-reward-modal').style.display = 'block';
        // Close the modal when the user clicks the close button
        document.getElementById('card-reward-modal-close').addEventListener('click', () => {
            document.getElementById('card-reward-modal').style.display = 'none';
        });   
    } catch (error) {
        console.error('Error fetching cards:', error);
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