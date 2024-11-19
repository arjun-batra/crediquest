/*/ Registering Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}
*/
//Unregistering Service Worker
if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        registrations.forEach(function(registration) {
            registration.unregister();
        });
    });
}

let categoriesData = [];

// Fetch data from JSON file
fetch('multiplier_data.json')
    .then(response => response.json())
    .then(data => {
        categoriesData = data;
        populateCategoryDropdown();
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });

// Populate category dropdown with categories
function populateCategoryDropdown() {
    const categoryDropdown = document.getElementById("category");
    categoriesData.forEach(category => {
        const option = document.createElement("option");
        option.value = category.Category;
        option.textContent = category.Category;
        categoryDropdown.appendChild(option);
    });
}

// Function to find stores based on the subcategory input and display cards with store names
function findMultiplier() {
    const subcategoryInput = document.getElementById("subcategory").value.trim().toLowerCase();
    const categoryInput = document.getElementById("category").value;
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML = ""; // Clear previous results

    // Case for when subcategory input is given
    if (subcategoryInput && !categoryInput) {
        let matchFound = false;

        categoriesData.forEach(categoryData => {
            if (categoryData.Subcategories.length > 0) {
                const matchingSubcategories = categoryData.Subcategories.filter(sub => 
                    sub.Subcategory.toLowerCase().includes(subcategoryInput)
                );

                matchingSubcategories.forEach(subcategoryMatch => {
                    matchFound = true;

                    // Create a card for the matched store with only store name
                    const card = document.createElement("div");
                    card.classList.add("store-card");
                    card.innerHTML = `<h3>${subcategoryMatch.Subcategory}</h3>`; // Only store name
                    card.addEventListener("click", () => {
                        console.log("Card clicked");  // Debugging line
                        showModal(subcategoryMatch.Subcategory, subcategoryMatch.Multipliers);
                    });
                    outputDiv.appendChild(card);
                });
            }
        });

        if (!matchFound) {
            outputDiv.innerHTML = "<p>No match found for the store name entered. Enter a store name or select a Reward Category.</p>";
        }
    } 
    // Case for when category is selected
    else if (categoryInput && !subcategoryInput) {
        let matchFound = false;
        categoriesData.forEach(categoryData => {
            if (categoryData.Category === categoryInput) {
                matchFound = true;

                // Sort the multipliers and display them
                const sortedMultipliers = sortMultipliers(categoryData.Multipliers);
                const multipliersHtml = sortedMultipliers.map(m => `<p>${formatMultiplierText(m)}</p>`).join("");

                outputDiv.innerHTML = `<h3>Multipliers for ${categoryData.Category}</h3>` + multipliersHtml;
            }
        });

        if (!matchFound) {
            outputDiv.innerHTML = "<p>No category selected or no multipliers found for the selected category.</p>";
        }
    } 
    // Case for when neither subcategory nor category is input
    else {
        outputDiv.innerHTML = "<p>Please enter a Store Name or select a Reward Category.</p>";
    }
}

// Function to display the modal with store multiplier details
function showModal(storeName, multipliers) {
    console.log("showModal called");  // Debugging line
    const storeModal = document.getElementById("storeModal");
    const storeNameElement = document.getElementById("storeName");
    const modalDetailsElement = document.getElementById("modalDetails");

    // Check if multipliers is an object and convert it to an array
    const multiplierArray = Object.keys(multipliers).map(key => ({
        Card: key,
        Multiplier: multipliers[key]
    }));

    storeNameElement.textContent = storeName;
    modalDetailsElement.innerHTML = multiplierArray.map(m => `<p>${formatMultiplierText(m)}</p>`).join("");

    storeModal.style.display = "flex"; // Show the modal as a full-screen overlay
}

// Close modal when clicking on the close button
document.getElementById("closeBtn").addEventListener("click", function() {
    const storeModal = document.getElementById("storeModal");
    storeModal.style.display = "none";
});

// Close modal when clicking anywhere outside the modal content (on the overlay)
window.addEventListener("click", function(event) {
    const storeModal = document.getElementById("storeModal");
    if (event.target === storeModal) { // Close if clicked on the overlay (background)
        storeModal.style.display = "none";
    }
});




// Function to format multiplier text
function formatMultiplierText(multiplierObj) {
    if (multiplierObj.Multiplier === null) {
        return `${multiplierObj.Card}: Multiplier Unknown`;
    }
    return `${multiplierObj.Card}: ${multiplierObj.Multiplier}x`;
}

// Sort multipliers in descending order
function sortMultipliers(multipliers) {
    const sorted = Object.keys(multipliers).map(card => ({
        Card: card,
        Multiplier: multipliers[card]
    }));
    return sorted.sort((a, b) => b.Multiplier - a.Multiplier);
}

// Event listener for 'Enter' key to trigger findMultiplier
document.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        findMultiplier();
    }
});

// Event listener to clear category dropdown when typing in subcategory
document.getElementById("subcategory").addEventListener("input", function() {
    document.getElementById("category").value = ""; // Clear category selection
});

// Event listener to clear subcategory input when selecting a category
document.getElementById("category").addEventListener("change", function() {
    document.getElementById("subcategory").value = ""; // Clear subcategory input
});
