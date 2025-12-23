#!/usr/bin/env python3
"""
Check if the original GeoJSON has ADMIN property and compare with name property.
"""

import json
import urllib.request

GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

with urllib.request.urlopen(GEOJSON_URL) as response:
    geo_json = json.loads(response.read())

print(f'Total features: {len(geo_json["features"])}\n')

# Check if ADMIN property exists
has_admin = False
admin_different = []

for feature in geo_json['features']:
    props = feature['properties']
    name = props.get('name', '')
    admin = props.get('ADMIN', '')
    
    if admin:
        has_admin = True
        if admin != name:
            admin_different.append((name, admin))

print(f'Has ADMIN property: {has_admin}')
print(f'Features where ADMIN != name: {len(admin_different)}\n')

if admin_different:
    print('Sample differences:')
    for name, admin in admin_different[:10]:
        print(f'  name: "{name}" -> ADMIN: "{admin}"')

# Check for non-country features
non_country_keywords = ['Sovereign Base', 'Cosmodrome', 'Bank', 'Island', 'Territory', 'Dhekelia', 'Akrotiri', 'Bir Tawil']
non_countries = []

for feature in geo_json['features']:
    props = feature['properties']
    name = props.get('ADMIN') or props.get('name') or ''
    
    for keyword in non_country_keywords:
        if keyword.lower() in name.lower():
            non_countries.append(name)
            break

print(f'\nNon-country features found: {len(non_countries)}')
for nc in sorted(set(non_countries))[:20]:
    print(f'  - {nc}')

