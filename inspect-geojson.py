#!/usr/bin/env python3
"""
Script to inspect GeoJSON features and identify what distinguishes countries from cities.
"""

import json
import urllib.request
import sys

GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

print(f'Downloading GeoJSON from: {GEOJSON_URL}')

try:
    with urllib.request.urlopen(GEOJSON_URL) as response:
        geo_json = json.loads(response.read())
    
    print(f'Loaded GeoJSON with {len(geo_json["features"])} features\n')
    
    # Find features with city-like names
    city_keywords = ['Amman', 'Mecca', 'Port Sudan', 'Cairo', 'Baghdad', 'Tehran']
    city_features = []
    
    for feature in geo_json['features']:
        props = feature['properties']
        name = props.get('ADMIN') or props.get('name') or ''
        
        for keyword in city_keywords:
            if keyword.lower() in name.lower():
                city_features.append((name, props))
                break
    
    print('Found city-like features:')
    for name, props in city_features:
        print(f'\n  Name: {name}')
        print(f'  All properties: {list(props.keys())}')
        for key, value in props.items():
            print(f'    {key}: {value}')
    
    # Check all unique property keys across all features
    print('\n\nAll unique property keys in GeoJSON:')
    all_keys = set()
    for feature in geo_json['features']:
        all_keys.update(feature['properties'].keys())
    
    for key in sorted(all_keys):
        print(f'  - {key}')
    
    # Sample a few features to see structure
    print('\n\nSample features (first 5):')
    for i, feature in enumerate(geo_json['features'][:5]):
        props = feature['properties']
        name = props.get('ADMIN') or props.get('name') or 'Unknown'
        print(f'\n  Feature {i+1}: {name}')
        print(f'    Properties: {list(props.keys())}')
        for key, value in props.items():
            if key not in ['geometry', 'coordinates']:
                print(f'      {key}: {value}')
    
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)

