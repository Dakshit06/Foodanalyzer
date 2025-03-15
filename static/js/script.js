// static/js/script.js
document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('food-label');
    const fileName = document.getElementById('file-name');
    const analyzeBtn = document.getElementById('analyze-btn');
    const esp32CamBtn = document.getElementById('esp32-cam-btn');
    const loadingIndicator = document.getElementById('loading');
    const resultsSection = document.getElementById('results-section');
    
    // Update file name when file is selected
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            fileName.textContent = this.files[0].name;
        } else {
            fileName.textContent = 'No file selected';
        }
    });
    
    // Handle form submission
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!fileInput.files || !fileInput.files[0]) {
            alert('Please select a file');
            return;
        }
        
        // Show loading indicator
        loadingIndicator.style.display = 'flex';
        
        // Create FormData and submit
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
            // Display results
            displayResults(data);
            
            // Show results section
            resultsSection.style.display = 'block';
            
            // Scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            loadingIndicator.style.display = 'none';
            alert('Error: ' + error.message);
            console.error('Error:', error);
        });
    });
    
    // ESP32-CAM button click handler
    esp32CamBtn.addEventListener('click', function() {
        connectToESP32Cam();
    });
    
    // Function to display analysis results
    function displayResults(data) {
        // Display uploaded image
        const previewImage = document.getElementById('preview-image');
        previewImage.src = data.image_url;
        
        // Display ingredients
        const ingredientsText = document.getElementById('ingredients-text');
        ingredientsText.textContent = data.ingredients || 'No ingredients detected';
        
        // Display harmful ingredients
        const harmfulIngredientsContainer = document.getElementById('harmful-ingredients');
        harmfulIngredientsContainer.innerHTML = '';
        
        if (data.harmful_ingredients && data.harmful_ingredients.length > 0) {
            data.harmful_ingredients.forEach(item => {
                const ingredientDiv = document.createElement('div');
                ingredientDiv.className = 'harmful-ingredient';
                
                const heading = document.createElement('h4');
                heading.textContent = item.ingredient;
                
                const description = document.createElement('p');
                description.textContent = item.description;
                
                ingredientDiv.appendChild(heading);
                ingredientDiv.appendChild(description);
                harmfulIngredientsContainer.appendChild(ingredientDiv);
            });
        } else {
            harmfulIngredientsContainer.textContent = 'No harmful ingredients detected';
        }
        
        // Display nutrition information
        const nutritionInfoContainer = document.getElementById('nutrition-info');
        nutritionInfoContainer.innerHTML = '';
        
        if (data.nutrition_info && Object.keys(data.nutrition_info).length > 0) {
            const table = document.createElement('table');
            table.className = 'nutrition-table';
            
            const tableHead = document.createElement('thead');
            const headRow = document.createElement('tr');
            const nutrientHeader = document.createElement('th');
            nutrientHeader.textContent = 'Nutrient';
            const valueHeader = document.createElement('th');
            valueHeader.textContent = 'Amount';
            
            headRow.appendChild(nutrientHeader);
            headRow.appendChild(valueHeader);
            tableHead.appendChild(headRow);
            table.appendChild(tableHead);
            
            const tableBody = document.createElement('tbody');
            
            for (const [nutrient, value] of Object.entries(data.nutrition_info)) {
                const row = document.createElement('tr');
                
                const nutrientCell = document.createElement('td');
                nutrientCell.textContent = nutrient.charAt(0).toUpperCase() + nutrient.slice(1);
                
                const valueCell = document.createElement('td');
                valueCell.textContent = value;
                
                row.appendChild(nutrientCell);
                row.appendChild(valueCell);
                tableBody.appendChild(row);
            }
            
            table.appendChild(tableBody);
            nutritionInfoContainer.appendChild(table);
        } else {
            nutritionInfoContainer.textContent = 'No nutrition information detected';
        }
        
        // Display health rating
        const healthRating = document.getElementById('health-rating');
        healthRating.innerHTML = '';
        
        // Calculate a simple health rating based on harmful ingredients
        let stars = 5;
        if (data.harmful_ingredients) {
            stars = Math.max(1, 5 - data.harmful_ingredients.length);
        }
        
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('span');
            star.className = 'star';
            star.textContent = i < stars ? '★' : '☆';
            healthRating.appendChild(star);
        }
        
        // Display recommendations
        const recommendationsText = document.getElementById('recommendations-text');
        
        if (data.harmful_ingredients && data.harmful_ingredients.length > 0) {
            recommendationsText.textContent = 'This product contains potentially harmful ingredients. Consider looking for alternatives without these ingredients for a healthier option.';
        } else {
            recommendationsText.textContent = 'No specific concerns detected with this product based on the ingredients analyzed.';
        }
    }
    
    // Function to connect to ESP32-CAM
    function connectToESP32Cam() {
        alert('Attempting to connect to ESP32-CAM...');
        
        // This would be implemented to connect to the ESP32-CAM
        // For this example, we'll just show a message
        setTimeout(() => {
            alert('ESP32-CAM functionality would be implemented here in a real application. For this prototype, please use the file upload option.');
        }, 1000);
    }
});
