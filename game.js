// Border Blind - Game Logic with Leaflet

class BorderBlindGame {
    constructor() {
        this.currentRound = 0;
        this.totalRounds = 10;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        
        this.currentRegion = null;
        this.currentRegionKey = null;
        this.missingCountry = null;
        this.absorbingCountry = null;
        this.hasGuessed = false;
        
        this.map = null;
        this.geoJsonLayer = null;
        this.countryLayers = {};
        this.geoJsonData = null;
        this.absorbedLayer = null;
        this.absorbingCountryColor = null;
        this.tileLayer = null;
        
        // Map detail level (lower = less detail, higher = more street-level detail)
        this.tileMaxZoom = 5;
        this.tileOpacity = 0.3;
        this.tileStyle = 'none'; // 'none', 'dark', 'dark-gray', 'voyager', 'watercolor'
        
        this.usedCombinations = new Set();
        
        // DOM Elements
        this.screens = {
            start: document.getElementById('start-screen'),
            game: document.getElementById('game-screen'),
            end: document.getElementById('end-screen')
        };
        
        this.elements = {
            roundNumber: document.getElementById('round-number'),
            regionName: document.getElementById('region-name'),
            score: document.getElementById('score'),
            mapContainer: document.getElementById('map-container'),
            hintText: document.getElementById('hint-text'),
            loadingOverlay: document.getElementById('loading-overlay'),
            feedbackOverlay: document.getElementById('feedback-overlay'),
            feedbackIcon: document.getElementById('feedback-icon'),
            feedbackTitle: document.getElementById('feedback-title'),
            feedbackMessage: document.getElementById('feedback-message'),
            finalScore: document.getElementById('final-score'),
            scoreMessage: document.getElementById('score-message'),
            correctCount: document.getElementById('correct-count'),
            wrongCount: document.getElementById('wrong-count')
        };
        
        this.bindEvents();
        this.loadGeoJson();
    }
    
    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('next-btn').addEventListener('click', () => this.nextRound());
        document.getElementById('play-again-btn').addEventListener('click', () => this.resetGame());
    }
    
    async loadGeoJson() {
        try {
            console.log('Loading GeoJSON from:', GEOJSON_URL);
            const response = await fetch(GEOJSON_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.geoJsonData = await response.json();
            console.log('GeoJSON loaded successfully, features:', this.geoJsonData.features.length);
            
            // Log some country names to help debug
            const names = this.geoJsonData.features.slice(0, 10).map(f => f.properties.ADMIN || f.properties.name);
            console.log('Sample country names in GeoJSON:', names);
        } catch (error) {
            console.error('Failed to load GeoJSON:', error);
            alert('Failed to load map data. Please refresh the page.');
        }
    }
    
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        this.screens[screenName].classList.add('active');
    }
    
    startGame() {
        if (!this.geoJsonData) {
            alert('Map data is still loading. Please wait a moment and try again.');
            return;
        }
        
        this.currentRound = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.usedCombinations.clear();
        this.showScreen('game');
        this.initMap();
        this.nextRound();
    }
    
    initMap() {
        if (this.map) {
            this.map.remove();
        }
        
        this.map = L.map('map', {
            zoomControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            dragging: true,
            attributionControl: true,
            zoomSnap: 0.25
        });
        
        // Position zoom control in top-right
        this.map.zoomControl.setPosition('topright');
    }
    
    nextRound() {
        this.hideFeedback();
        this.currentRound++;
        
        if (this.currentRound > this.totalRounds) {
            this.endGame();
            return;
        }
        
        this.hasGuessed = false;
        this.updateUI();
        
        // Recreate the map to ensure clean state (prevents zoom issues between rounds)
        this.initMap();
        
        this.setupRound();
    }
    
    setupRound() {
        this.elements.loadingOverlay.classList.remove('hidden');
        
        // Pick a random region
        const regionKeys = Object.keys(REGIONS);
        this.currentRegionKey = regionKeys[Math.floor(Math.random() * regionKeys.length)];
        this.currentRegion = REGIONS[this.currentRegionKey];
        
        console.log('Selected region:', this.currentRegion.name);
        
        // Find a country with neighbors
        const countriesWithNeighbors = Object.entries(this.currentRegion.countries)
            .filter(([_, data]) => data.adjacent && data.adjacent.length > 0);
        
        if (countriesWithNeighbors.length === 0) {
            console.log('No countries with neighbors, trying another region');
            this.setupRound();
            return;
        }
        
        // Pick a random country to be "missing"
        let attempts = 0;
        let found = false;
        
        while (!found && attempts < 100) {
            const [missingName, missingData] = countriesWithNeighbors[
                Math.floor(Math.random() * countriesWithNeighbors.length)
            ];
            
            // Pick a random neighbor that exists in this region
            const validNeighbors = missingData.adjacent.filter(n => this.currentRegion.countries[n]);
            
            if (validNeighbors.length > 0) {
                const neighborName = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
                const combinationKey = `${this.currentRegionKey}-${missingName}-${neighborName}`;
                
                if (!this.usedCombinations.has(combinationKey)) {
                    this.usedCombinations.add(combinationKey);
                    this.missingCountry = { name: missingName, ...missingData };
                    this.absorbingCountry = { 
                        name: neighborName, 
                        ...this.currentRegion.countries[neighborName] 
                    };
                    found = true;
                    console.log('Missing country:', missingName, '-> Absorbed by:', neighborName);
                }
            }
            attempts++;
        }
        
        if (!found) {
            // Just pick any valid combination
            for (const [missingName, missingData] of countriesWithNeighbors) {
                const validNeighbors = missingData.adjacent.filter(n => this.currentRegion.countries[n]);
                if (validNeighbors.length > 0) {
                    this.missingCountry = { name: missingName, ...missingData };
                    this.absorbingCountry = {
                        name: validNeighbors[0],
                        ...this.currentRegion.countries[validNeighbors[0]]
                    };
                    console.log('Fallback - Missing country:', missingName, '-> Absorbed by:', validNeighbors[0]);
                    break;
                }
            }
        }
        
        this.elements.regionName.textContent = this.currentRegion.name;
        this.renderMap();
    }
    
    renderMap() {
        // Clear existing layers
        if (this.map) {
            this.map.eachLayer(layer => {
                if (layer instanceof L.GeoJSON || layer instanceof L.TileLayer) {
                    this.map.removeLayer(layer);
                }
            });
        }
        this.countryLayers = {};
        this.absorbedLayer = null;
        
        // IMPORTANT: Reset all constraints BEFORE fitting to new bounds
        // Otherwise previous round's constraints prevent proper zoom/pan
        this.map.setMinZoom(0);
        this.map.setMaxZoom(20);
        this.map.setMaxBounds(null);
        
        // Invalidate size to ensure map recalculates properly
        this.map.invalidateSize();
        
        // Set map bounds for new region
        const bounds = L.latLngBounds(this.currentRegion.bounds);
        
        // Fit to bounds and store the base zoom level
        this.map.fitBounds(bounds, { padding: [30, 30] });
        const baseZoom = this.map.getZoom();
        const center = bounds.getCenter();
        
        // Store these for resetting if needed
        this.baseZoom = baseZoom;
        this.baseCenter = center;
        this.currentBounds = bounds;
        
        // Now set zoom constraints: can't zoom out past the region, but can zoom in
        this.map.setMinZoom(baseZoom);
        this.map.setMaxZoom(baseZoom + 4);
        
        // Set max bounds with padding so you can pan within the region
        this.map.setMaxBounds(bounds.pad(0.15));
        
        // Add background tile layer based on selected style
        // 'none' = solid background only (cleanest for seeing just country borders)
        const tileUrls = {
            'dark': 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
            'dark-gray': 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            'voyager': 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
            'watercolor': 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg'
        };
        
        this.tileLayer = null;
        if (this.tileStyle !== 'none' && tileUrls[this.tileStyle]) {
            this.tileLayer = L.tileLayer(tileUrls[this.tileStyle], {
                maxZoom: this.tileMaxZoom,
                maxNativeZoom: this.tileMaxZoom,
                opacity: this.tileOpacity,
                attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(this.map);
        }
        // If 'none', no tile layer is added - just the solid CSS background
        
        if (!this.geoJsonData) {
            console.error('GeoJSON data not loaded');
            this.elements.loadingOverlay.classList.add('hidden');
            return;
        }
        
        // Create the name mapping
        const nameMapping = this.createNameMapping();
        console.log('Name mapping created:', Object.keys(nameMapping).length, 'countries mapped');
        
        // Assign colors using graph coloring algorithm (no adjacent countries share colors)
        const colorAssignment = this.assignColorsToRegion();
        console.log('Colors assigned via graph coloring');
        
        // Store absorbing country's color
        this.absorbingCountryColor = colorAssignment[this.absorbingCountry.name];
        
        // Get list of countries in this region
        const regionCountryNames = Object.keys(this.currentRegion.countries);
        
        // Find the features for absorbing and absorbed countries
        let absorbingFeature = null;
        let absorbedFeature = null;
        
        this.geoJsonData.features.forEach(feature => {
            const geoName = feature.properties.ADMIN || feature.properties.name;
            const mappedName = nameMapping[geoName];
            
            if (mappedName === this.absorbingCountry.name) {
                absorbingFeature = feature;
            } else if (mappedName === this.missingCountry.name) {
                absorbedFeature = feature;
            }
        });
        
        // Render all countries EXCEPT the absorbing and missing ones
        this.geoJsonData.features.forEach(feature => {
            const geoName = feature.properties.ADMIN || feature.properties.name;
            const mappedName = nameMapping[geoName];
            
            if (!mappedName || !regionCountryNames.includes(mappedName)) return;
            
            const isMissing = mappedName === this.missingCountry.name;
            const isAbsorbing = mappedName === this.absorbingCountry.name;
            
            // Skip both - we'll render them merged
            if (isMissing || isAbsorbing) return;
            
            const color = colorAssignment[mappedName];
            this.createCountryLayer(feature, mappedName, color, false);
        });
        
        // Store the absorbed feature for showing the outline in feedback
        this.absorbedFeature = absorbedFeature;
        this.absorbingFeature = absorbingFeature;
        this.answerOutlineLayer = null;
        this.answerOutlineShadow = null;
        
        // Merge and render the absorbing + absorbed countries as one unified shape
        if (absorbingFeature && absorbedFeature) {
            this.createMergedLayer(absorbingFeature, absorbedFeature, this.absorbingCountryColor);
        } else if (absorbingFeature) {
            // Fallback if we couldn't find the absorbed feature
            this.createCountryLayer(absorbingFeature, this.absorbingCountry.name, this.absorbingCountryColor, true);
        }
        
        this.elements.loadingOverlay.classList.add('hidden');
        this.elements.hintText.textContent = 'Click on the country that\'s missing!';
    }
    
    createCountryLayer(feature, countryName, color) {
        const self = this;
        
        const layer = L.geoJSON(feature, {
            style: {
                fillColor: color,
                fillOpacity: 0.8,
                color: '#f1f5f9',
                weight: 2,
                opacity: 1
            }
        }).addTo(this.map);
        
        // Add event handlers to each sub-layer
        layer.eachLayer(function(subLayer) {
            subLayer.on('mouseover', function(e) {
                if (self.hasGuessed) return;
                this.setStyle({
                    fillOpacity: 1,
                    weight: 3,
                    color: '#22d3ee'
                });
                this.bringToFront();
            });
            
            subLayer.on('mouseout', function(e) {
                if (self.hasGuessed) return;
                this.setStyle({
                    fillOpacity: 0.8,
                    weight: 2,
                    color: '#f1f5f9'
                });
            });
            
            subLayer.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                self.handleGuess(countryName, false);
            });
        });
        
        this.countryLayers[countryName] = layer;
    }
    
    createMergedLayer(absorbingFeature, absorbedFeature, color) {
        const self = this;
        
        // Use Turf.js to merge the two polygons into one
        let mergedGeoJson;
        try {
            mergedGeoJson = turf.union(
                turf.feature(absorbingFeature.geometry),
                turf.feature(absorbedFeature.geometry)
            );
        } catch (e) {
            console.error('Failed to merge polygons:', e);
            // Fallback: render them separately with no internal borders
            this.createCountryLayer(absorbingFeature, this.absorbingCountry.name, color, true);
            this.createFallbackAbsorbedLayer(absorbedFeature, color);
            return;
        }
        
        // Render the merged shape with normal white border
        const layer = L.geoJSON(mergedGeoJson, {
            style: {
                fillColor: color,
                fillOpacity: 0.8,
                color: '#f1f5f9',
                weight: 2,
                opacity: 1
            }
        }).addTo(this.map);
        
        // Add event handlers
        layer.eachLayer(function(subLayer) {
            subLayer.on('mouseover', function(e) {
                if (self.hasGuessed) return;
                this.setStyle({
                    fillOpacity: 1,
                    weight: 3,
                    color: '#22d3ee'
                });
                this.bringToFront();
            });
            
            subLayer.on('mouseout', function(e) {
                if (self.hasGuessed) return;
                this.setStyle({
                    fillOpacity: 0.8,
                    weight: 2,
                    color: '#f1f5f9'
                });
            });
            
            subLayer.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                // Clicking the merged territory = correct answer
                self.handleGuess(self.absorbingCountry.name, true);
            });
        });
        
        // Store references for feedback highlighting
        this.absorbedLayer = layer;
        this.countryLayers[this.absorbingCountry.name] = layer;
    }
    
    // Fallback if Turf merge fails
    createFallbackAbsorbedLayer(feature, color) {
        const self = this;
        
        const layer = L.geoJSON(feature, {
            style: {
                fillColor: color,
                fillOpacity: 0.8,
                color: color,
                weight: 0,
                opacity: 0
            }
        }).addTo(this.map);
        
        layer.eachLayer(function(subLayer) {
            subLayer.on('mouseover', function(e) {
                if (self.hasGuessed) return;
                this.setStyle({
                    fillOpacity: 1,
                    weight: 3,
                    color: '#22d3ee'
                });
                this.bringToFront();
            });
            
            subLayer.on('mouseout', function(e) {
                if (self.hasGuessed) return;
                this.setStyle({
                    fillOpacity: 0.8,
                    weight: 0,
                    color: color,
                    opacity: 0
                });
            });
            
            subLayer.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                self.handleGuess(self.absorbingCountry.name, true);
            });
        });
        
        this.absorbedLayer = layer;
    }
    
    createNameMapping() {
        const mapping = {};
        const regionCountryNames = Object.keys(this.currentRegion.countries);
        
        // Common name variations between GeoJSON and our data
        // Only includes mappings where GeoJSON name differs from our name
        const variations = {
            'Czech Republic': ['Czechia'],
            'Serbia': ['Republic of Serbia'],
            'Eswatini': ['eSwatini'],
            'Tanzania': ['United Republic of Tanzania'],
            'The Gambia': ['Gambia']
        };
        
        // Reverse mapping: GeoJSON name -> our name
        const reverseVariations = {};
        for (const [ourName, geoNames] of Object.entries(variations)) {
            for (const geoName of geoNames) {
                reverseVariations[geoName] = ourName;
            }
        }
        
        this.geoJsonData.features.forEach(feature => {
            const geoName = feature.properties.ADMIN || feature.properties.name;
            
            // Direct match
            if (regionCountryNames.includes(geoName)) {
                mapping[geoName] = geoName;
                return;
            }
            
            // Check if we have a reverse variation (GeoJSON name maps to our name)
            if (reverseVariations[geoName] && regionCountryNames.includes(reverseVariations[geoName])) {
                mapping[geoName] = reverseVariations[geoName];
                return;
            }
            
            // Check our variations (our name might have GeoJSON alternatives)
            for (const regionName of regionCountryNames) {
                if (variations[regionName] && variations[regionName].includes(geoName)) {
                    mapping[geoName] = regionName;
                    return;
                }
            }
        });
        
        return mapping;
    }
    
    // Graph coloring algorithm to ensure adjacent countries have different colors
    // Uses DSatur algorithm - colors vertices by saturation degree (most constrained first)
    // Treats missing + absorbing countries as a merged entity for coloring
    // Also considers oceanNeighbors - countries visually close across water
    assignColorsToRegion() {
        // Color palette - 6 distinct, visually different colors (4 is minimum for maps)
        const colorPalette = [
            '#3b82f6', // blue
            '#ef4444', // red  
            '#22c55e', // green
            '#f59e0b', // amber
            '#8b5cf6', // violet
            '#06b6d4', // cyan
        ];
        
        const missingName = this.missingCountry.name;
        const absorbingName = this.absorbingCountry.name;
        
        // Get all countries EXCEPT the missing one (it will share color with absorbing)
        const countries = Object.keys(this.currentRegion.countries).filter(c => c !== missingName);
        
        // Build adjacency list (includes both land and ocean neighbors)
        const adj = {};
        for (const c of countries) {
            adj[c] = [];
        }
        
        for (const country of countries) {
            const countryData = this.currentRegion.countries[country];
            
            // Add land-adjacent neighbors
            const landNeighbors = countryData.adjacent || [];
            for (const neighbor of landNeighbors) {
                // Skip the missing country - its adjacencies are merged into absorbing
                if (neighbor === missingName) continue;
                
                if (countries.includes(neighbor)) {
                    if (!adj[country].includes(neighbor)) {
                        adj[country].push(neighbor);
                    }
                    if (!adj[neighbor].includes(country)) {
                        adj[neighbor].push(country);
                    }
                }
            }
            
            // Add ocean neighbors (countries visually close across water)
            const oceanNeighbors = countryData.oceanNeighbors || [];
            for (const neighbor of oceanNeighbors) {
                // Skip the missing country - its adjacencies are merged into absorbing
                if (neighbor === missingName) continue;
                
                if (countries.includes(neighbor)) {
                    if (!adj[country].includes(neighbor)) {
                        adj[country].push(neighbor);
                    }
                    if (!adj[neighbor].includes(country)) {
                        adj[neighbor].push(country);
                    }
                }
            }
        }
        
        // CRITICAL: Merge missing country's neighbors into absorbing country's neighbors
        // The absorbing country must avoid colors of BOTH its own neighbors AND the missing country's neighbors
        const missingData = this.currentRegion.countries[missingName];
        
        // Merge land neighbors
        const missingLandNeighbors = missingData.adjacent || [];
        for (const neighbor of missingLandNeighbors) {
            // Skip the absorbing country itself and the missing country
            if (neighbor === absorbingName || neighbor === missingName) continue;
            
            if (countries.includes(neighbor)) {
                // Add this as a neighbor of the absorbing country
                if (!adj[absorbingName].includes(neighbor)) {
                    adj[absorbingName].push(neighbor);
                }
                // Also add absorbing as neighbor of this country
                if (!adj[neighbor].includes(absorbingName)) {
                    adj[neighbor].push(absorbingName);
                }
            }
        }
        
        // Merge ocean neighbors from missing country
        const missingOceanNeighbors = missingData.oceanNeighbors || [];
        for (const neighbor of missingOceanNeighbors) {
            // Skip the absorbing country itself and the missing country
            if (neighbor === absorbingName || neighbor === missingName) continue;
            
            if (countries.includes(neighbor)) {
                // Add this as a neighbor of the absorbing country
                if (!adj[absorbingName].includes(neighbor)) {
                    adj[absorbingName].push(neighbor);
                }
                // Also add absorbing as neighbor of this country
                if (!adj[neighbor].includes(absorbingName)) {
                    adj[neighbor].push(absorbingName);
                }
            }
        }
        
        // DSatur: track color and saturation for each vertex
        const color = {};      // color[v] = assigned color or null
        const saturation = {}; // saturation[v] = set of different colors in neighbors
        
        for (const c of countries) {
            color[c] = null;
            saturation[c] = new Set();
        }
        
        // Helper: get the lowest available color index for a vertex
        const getLowestAvailableColorIndex = (vertex) => {
            const neighborColors = new Set();
            for (const neighbor of adj[vertex]) {
                if (color[neighbor] !== null) {
                    const colorIndex = colorPalette.indexOf(color[neighbor]);
                    neighborColors.add(colorIndex);
                }
            }
            
            for (let i = 0; i < colorPalette.length; i++) {
                if (!neighborColors.has(i)) {
                    return i;
                }
            }
            return 0; // Fallback (shouldn't happen)
        };
        
        // Helper: get uncolored vertex with highest saturation (ties broken by degree)
        const getNextVertex = () => {
            let best = null;
            let bestSat = -1;
            let bestDeg = -1;
            
            for (const v of countries) {
                if (color[v] !== null) continue;
                
                const sat = saturation[v].size;
                const deg = adj[v].length;
                
                if (sat > bestSat || (sat === bestSat && deg > bestDeg)) {
                    best = v;
                    bestSat = sat;
                    bestDeg = deg;
                }
            }
            
            return best;
        };
        
        // Color all vertices using DSatur
        for (let i = 0; i < countries.length; i++) {
            const vertex = getNextVertex();
            if (vertex === null) break;
            
            const colorIndex = getLowestAvailableColorIndex(vertex);
            color[vertex] = colorPalette[colorIndex];
            
            // Update saturation of uncolored neighbors
            for (const neighbor of adj[vertex]) {
                if (color[neighbor] === null) {
                    saturation[neighbor].add(colorIndex);
                }
            }
        }
        
        // Verify no conflicts
        for (const c of countries) {
            for (const neighbor of adj[c]) {
                if (color[c] === color[neighbor]) {
                    console.error(`CONFLICT: ${c} and ${neighbor} both have ${color[c]}`);
                }
            }
        }
        
        // Assign the missing country the same color as the absorbing country
        // (it's visually merged, so they share the same color)
        color[missingName] = color[absorbingName];
        
        return color;
    }
    
    handleGuess(countryName, isAbsorbingTerritory) {
        if (this.hasGuessed) return;
        this.hasGuessed = true;
        
        console.log('Guess made:', countryName, 'Is correct territory:', isAbsorbingTerritory);
        
        // The correct answer is clicking on the absorbing country's territory
        // (which includes the absorbed country's area)
        if (isAbsorbingTerritory) {
            this.score++;
            this.correctCount++;
            this.showCorrectFeedback();
        } else {
            this.wrongCount++;
            this.showWrongFeedback(countryName);
        }
    }
    
    showCorrectFeedback() {
        // Show a green overlay on just the absorbed country to reveal the answer
        this.showAbsorbedCountryOverlay(true);
        
        this.elements.feedbackIcon.className = 'feedback-icon correct';
        this.elements.feedbackIcon.innerHTML = '✓';
        this.elements.feedbackTitle.className = 'correct';
        this.elements.feedbackTitle.textContent = 'Correct!';
        this.elements.feedbackMessage.innerHTML = `
            <strong>${this.missingCountry.name}</strong> was absorbed into 
            <strong>${this.absorbingCountry.name}</strong>!
        `;
        
        this.showFeedback();
        this.updateUI();
    }
    
    showWrongFeedback(guessedCountry) {
        // Show a colored overlay on just the absorbed country to reveal the answer
        this.showAbsorbedCountryOverlay(false);
        
        this.elements.feedbackIcon.className = 'feedback-icon wrong';
        this.elements.feedbackIcon.innerHTML = '✗';
        this.elements.feedbackTitle.className = 'wrong';
        this.elements.feedbackTitle.textContent = 'Not quite!';
        this.elements.feedbackMessage.innerHTML = `
            <strong>${this.missingCountry.name}</strong> was absorbed into 
            <strong>${this.absorbingCountry.name}</strong>.<br>
            <span style="color: var(--text-muted); font-size: 0.9em;">
                (The highlighted area shows the missing country)
            </span>
        `;
        
        this.showFeedback();
    }
    
    showAbsorbedCountryOverlay(isCorrect) {
        // Draw a colored overlay on the absorbed country to clearly show where it was
        if (!this.absorbedFeature) return;
        
        // Remove any existing overlay layers
        if (this.answerOutlineLayer) {
            this.map.removeLayer(this.answerOutlineLayer);
        }
        if (this.answerOutlineShadow) {
            this.map.removeLayer(this.answerOutlineShadow);
        }
        
        // Green for correct, pink/magenta for wrong - both stand out clearly
        const overlayColor = isCorrect ? '#22c55e' : '#ec4899';
        
        // Create a filled overlay with the absorbed country's shape
        this.answerOutlineLayer = L.geoJSON(this.absorbedFeature, {
            style: {
                fillColor: overlayColor,
                fillOpacity: 0.75,
                color: '#ffffff',
                weight: 4,
                opacity: 1
            }
        }).addTo(this.map);
        
        this.answerOutlineLayer.bringToFront();
        
        // Add animation class for pulsing effect
        this.answerOutlineLayer.eachLayer(subLayer => {
            const element = subLayer.getElement();
            if (element) {
                element.classList.add('absorbed-country-overlay');
            }
        });
    }
    
    showFeedback() {
        const nextBtn = document.getElementById('next-btn');
        nextBtn.textContent = this.currentRound >= this.totalRounds ? 'See Results' : 'Next Round';
        this.elements.feedbackOverlay.classList.add('active');
    }
    
    hideFeedback() {
        this.elements.feedbackOverlay.classList.remove('active');
    }
    
    updateUI() {
        this.elements.roundNumber.textContent = this.currentRound;
        this.elements.score.textContent = this.score;
    }
    
    endGame() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        
        this.elements.finalScore.textContent = this.score;
        this.elements.correctCount.textContent = this.correctCount;
        this.elements.wrongCount.textContent = this.wrongCount;
        
        let message = '';
        if (this.score === 10) {
            message = '🏆 Perfect! You\'re a geography master!';
        } else if (this.score >= 8) {
            message = '🌟 Excellent! You really know your borders!';
        } else if (this.score >= 6) {
            message = '👍 Good job! Keep practicing!';
        } else if (this.score >= 4) {
            message = '🗺️ Not bad! Time to study some maps!';
        } else {
            message = '📚 Keep learning, you\'ll get better!';
        }
        this.elements.scoreMessage.textContent = message;
        
        this.showScreen('end');
    }
    
    resetGame() {
        this.showScreen('start');
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new BorderBlindGame();
});
