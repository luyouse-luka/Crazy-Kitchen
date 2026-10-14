"""Prepare the selected CC0 assets; source cache lives outside the asset database."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'game/temp/art-swap'
OUT = ROOT / 'game/assets/art/restaurant'
OUT.mkdir(exist_ok=True)


from gltf_assets import bounds, load, pack

STATIC = {
    'fridge':'fridge_A', 'counter':'kitchencounter_straight_A', 'drawer':'kitchencounter_straight_B',
    'stove':'stove_multi', 'hotplate':'stove_single', 'sink':'kitchencounter_sink',
    'crate':'crate', 'crate-open':'crate', 'plate':'plate', 'pot':'pot_A',
    'bun':'food_ingredient_bun', 'patty':'food_ingredient_burger_uncooked',
    'cheese':'food_ingredient_cheese_slice', 'lettuce':'food_ingredient_lettuce_slice',
    'tomato':'food_ingredient_tomato_slice', 'burger':'food_burger', 'onion':'food_ingredient_onion_rings',
    'cuttingboard':'cuttingboard', 'dishrack':'dishrack_plates',
    'wall-panel':'wall', 'wall-window':'wall_window_closed',
    'terrace-table':'table_round_A_small_decorated', 'terrace-chair':'chair_A',
}
FURNITURE = {'shelf':'shelf_A_big','seat':'chair_A','plant':'cactus_medium_A','plant-small':'cactus_small_A'}
manifest={'assets':[], 'characters':[]}
for collection, mapping, folder, texture in [
    ('restaurant',STATIC,'kaykit/KayKit-Restaurant-Bits-1.0-main/addons/kaykit_restaurant_bits/Assets','restaurantbits_texture.png'),
    ('furniture',FURNITURE,'furniture/KayKit-Furniture-Bits-1.0-main/addons/kaykit_furniture_bits/Assets','furniturebits_texture.png'),
]:
    source=CACHE/folder
    from PIL import Image
    image=next(source.rglob(texture)); Image.open(image).resize((512,512),Image.Resampling.LANCZOS).save(OUT/texture)
    (OUT/('LICENSE-KayKit-'+collection+'.txt')).write_bytes((source/'LICENSE.txt').read_bytes())
    for key,name in mapping.items():
        j,b=load(source/'gltf'/(name+'.gltf'));lo,hi=bounds(j)
        roots=j['scenes'][j.get('scene',0)]['nodes'];j['nodes'].append({'name':key,'children':roots,'translation':[-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2]});j['scenes']=[{'name':key,'nodes':[len(j['nodes'])-1]}];j['scene']=0
        for im in j.get('images',[]):im['uri']=texture
        for material in j.get('materials', []):
            material['pbrMetallicRoughness'].update(metallicFactor=0, roughnessFactor=0.9)
        pack(j,b,OUT/(key+'.glb'),unlit=False)
        manifest['assets'].append({'name':key,'collection':collection,'source':name,'size':[hi[k]-lo[k] for k in range(3)]})


from import_art_direction import build_floors
manifest['assets'].extend(build_floors(CACHE, OUT))
from importlib import import_module
manifest['assets'].append(import_module('build-fryer').build_fryer(OUT))
from import_adventurers import build_characters
manifest['characters'] = build_characters()
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared',len(manifest['assets']),'static/decorative assets and',len(manifest['characters']),'KayKit characters')
