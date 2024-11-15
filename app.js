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

// Function to find multipliers based on category or subcategory input
function findMultiplier() {
    const category = document.getElementById("category").value;
    const subcategoryInput = document.getElementById("subcategory").value.trim().toLowerCase();
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML = ""; // Clear previous results

    if (category) {
        // If category is selected, show the multiplier for each card in that category
        const categoryData = categoriesData.find(item => item.Category === category);

        if (categoryData) {
            const sortedMultipliers = sortMultipliers(categoryData.Multipliers);
            outputDiv.innerHTML = `
                <h3>Reward Category: ${category}</h3>
                <p>${formatMultiplierText(sortedMultipliers[0])}</p>
                <p>${formatMultiplierText(sortedMultipliers[1])}</p>
                <p>${formatMultiplierText(sortedMultipliers[2])}</p>
            `;
        }
    } else if (subcategoryInput) {
        // If subcategory is entered, search for matching subcategories containing the input term
        let matchFound = false;

        categoriesData.forEach(categoryData => {
            if (categoryData.Subcategories.length > 0) {
                const matchingSubcategories = categoryData.Subcategories.filter(sub => 
                    sub.Subcategory.toLowerCase().includes(subcategoryInput)
                );

                matchingSubcategories.forEach(subcategoryMatch => {
                    matchFound = true;
                    const sortedMultipliers = sortMultipliers(subcategoryMatch.Multipliers);
                    outputDiv.innerHTML += `
                        <h3>Store name: ${subcategoryMatch.Subcategory}</h3>
                        <p>${formatMultiplierText(sortedMultipliers[0])}</p>
                        <p>${formatMultiplierText(sortedMultipliers[1])}</p>
                        <p>${formatMultiplierText(sortedMultipliers[2])}</p>
                    `;
                });
            }
        });

        if (!matchFound) {
            outputDiv.innerHTML = "<p>No match found for the store name entered. Enter a store name or select a Reward Category.</p>";
        }
    } else {
        outputDiv.innerHTML = "<p>Please select a Reward Category or enter a Store Name.</p>";
    }
}

// Helper function to format multiplier text
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

