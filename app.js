// Get DOM elements for store name input, reward type dropdown, and search button
const storeInput = document.getElementById('store-name');
const rewardDropdown = document.getElementById('reward-type');
const searchButton = document.getElementById('search-button');

// Function to clear store input when reward type is selected
rewardDropdown.addEventListener('change', () => {
    if (rewardDropdown.value !== "") {
        // Clear the store input field when a reward type is selected
        storeInput.value = "";
    }
});

// Function to reset the reward dropdown when user types in store name
storeInput.addEventListener('input', () => {
    // Reset the reward type dropdown to its default value
    rewardDropdown.value = "";
});

// Function to handle search button click or Enter key press
function handleSearch() {
    const storeName = storeInput.value.trim();
    const rewardType = rewardDropdown.value.trim();

    if (storeName === "" && rewardType === "") {
        alert("Please enter a store name or select a reward type.");
        return;
    }

    // Simulate a search (replace with actual search logic as needed)
    alert(`Searching for cards using store: "${storeName}" and reward type: "${rewardType}"`);

    // Clear inputs after search (optional)
    storeInput.value = "";
    rewardDropdown.value = "";
}

// Add event listener for search button click
searchButton.addEventListener('click', handleSearch);

// Optional: Allow user to press "Enter" to trigger search
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
