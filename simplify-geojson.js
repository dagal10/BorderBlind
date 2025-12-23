// Script to simplify GeoJSON to only include country names
// Downloads the GeoJSON, strips all properties except country name, and saves it

const https = require('https');
const fs = require('fs');

const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
const OUTPUT_FILE = 'countries-simple.geojson';

console.log('Downloading GeoJSON from:', GEOJSON_URL);

https.get(GEOJSON_URL, (response) => {
    let data = '';

    response.on('data', (chunk) => {
        data += chunk;
    });

    response.on('end', () => {
        try {
            const geoJson = JSON.parse(data);
            console.log(`Loaded GeoJSON with ${geoJson.features.length} features`);

            // Process each feature to keep only the country name
            const simplifiedFeatures = geoJson.features.map(feature => {
                const countryName = feature.properties.ADMIN || feature.properties.name || 'Unknown';
                
                return {
                    type: feature.type,
                    geometry: feature.geometry,
                    properties: {
                        name: countryName
                    }
                };
            });

            const simplifiedGeoJson = {
                type: geoJson.type,
                features: simplifiedFeatures
            };

            // Write to file
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(simplifiedGeoJson, null, 2));
            console.log(`✓ Simplified GeoJSON saved to ${OUTPUT_FILE}`);
            console.log(`  Reduced from ${JSON.stringify(geoJson).length} to ${JSON.stringify(simplifiedGeoJson).length} bytes`);
            
            // Show sample of country names
            console.log('\nSample country names:');
            simplifiedFeatures.slice(0, 10).forEach(f => {
                console.log(`  - ${f.properties.name}`);
            });
        } catch (error) {
            console.error('Error processing GeoJSON:', error);
            process.exit(1);
        }
    });
}).on('error', (error) => {
    console.error('Error downloading GeoJSON:', error);
    process.exit(1);
});

