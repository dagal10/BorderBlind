#!/usr/bin/env python3
"""
Script to simplify GeoJSON to only include country names.
Downloads the GeoJSON, strips all properties except country name, and saves it.
"""

import json
import urllib.request
import sys

GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
OUTPUT_FILE = 'countries-simple.geojson'

print(f'Downloading GeoJSON from: {GEOJSON_URL}')

try:
    # Download the GeoJSON
    with urllib.request.urlopen(GEOJSON_URL) as response:
        geo_json = json.loads(response.read())
    
    print(f'Loaded GeoJSON with {len(geo_json["features"])} features')
    
    # Filter to only include actual countries (those with ISO codes)
    # Also exclude known non-country features
    non_country_keywords = [
        'Sovereign Base Area', 'Cosmodrome', 'Bir Tawil', 'Bank (Petrel Is.)',
        'Ashmore and Cartier', 'Clipperton', 'Coral Sea Islands',
        'Heard Island and McDonald', 'Norfolk Island', 'Pitcairn',
        'Brazilian Island'
    ]
    
    # Process each feature to keep only actual countries
    simplified_features = []
    excluded_count = 0
    
    for feature in geo_json['features']:
        props = feature['properties']
        
        # Get country name
        country_name = props.get('name') or 'Unknown'
        
        # Check if it has ISO codes (real countries have ISO codes)
        has_iso = bool(props.get('ISO3166-1-Alpha-2') or props.get('ISO3166-1-Alpha-3'))
        
        # Check if it matches non-country keywords
        is_non_country = any(keyword.lower() in country_name.lower() for keyword in non_country_keywords)
        
        # Only include if it has ISO codes and is not a known non-country feature
        if has_iso and not is_non_country:
            simplified_feature = {
                'type': feature['type'],
                'geometry': feature['geometry'],
                'properties': {
                    'name': country_name
                }
            }
            simplified_features.append(simplified_feature)
        else:
            excluded_count += 1
            if excluded_count <= 10:  # Show first 10 excluded
                print(f'  Excluding: {country_name} (has_iso={has_iso}, is_non_country={is_non_country})')
    
    simplified_geo_json = {
        'type': geo_json['type'],
        'features': simplified_features
    }
    
    # Write to file
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(simplified_geo_json, f, indent=2, ensure_ascii=False)
    
    # Calculate size reduction
    original_size = len(json.dumps(geo_json))
    simplified_size = len(json.dumps(simplified_geo_json))
    
    print(f'\nFiltered: {len(geo_json["features"])} -> {len(simplified_features)} features')
    print(f'  Excluded {excluded_count} non-country features')
    
    print(f'\nSimplified GeoJSON saved to {OUTPUT_FILE}')
    print(f'  Reduced from {original_size:,} to {simplified_size:,} bytes')
    print(f'  Size reduction: {((1 - simplified_size/original_size) * 100):.1f}%')
    
    # Show sample of country names
    print('\nSample country names:')
    for feature in simplified_features[:15]:
        print(f'  - {feature["properties"]["name"]}')
    
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)

