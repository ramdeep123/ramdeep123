# NammaBusSim world maps

Each country map is generated in Blender by a script, so it can be rebuilt, tweaked or re-seeded. Every map exports a game-ready `.glb` plus a bus-route JSON. Roads are smooth splines inspired by how streets curve in each country. Junctions, rounded kerbs, medians, lane markings, building lots and the bus route are all derived from those curves.

| Map | Traffic | Signature roads & places | Folder |
|---|---|---|---|
| 🇯🇵 **Japan** — Sakuragaoka, Tokyo-style | left | Station bus rotary, elevated railway, utility poles and wires, narrow lanes, shrine | [`japan/`](japan/) |
| 🇮🇳 **India** — Mallige Nagar, Bengaluru-style | left | S-curved ORR under the metro, *Mallige Circle* roundabout, lake road, pete lanes, Kannada signage | [`india/`](india/) |
| 🇨🇳 **China** — Jinhe New District (金河新区) | right | 8-lane boulevard under an elevated expressway, river bridges, high-rise compounds, hutong, pagoda | [`china/`](china/) |
| 🇨🇦 **Canada** — Maplewood, Toronto-inspired | right | Queen St streetcar, crescents and cul-de-sacs, autumn maples, hydro poles, outdoor rink | [`canada/`](canada/) |
| 🇺🇸 **USA** — Palm Valley, SoCal-inspired | right | 6-lane stroad with a centre turn lane, freeway diamond interchange, strip mall and big-box store, palms, mountains | [`usa/`](usa/) |
| 🇩🇪 **Europe (Germany)** — Lindenfeld | right | Ring road with a tram, cobbled Gassen, Fachwerk houses, Marktplatz, Gothic church, Kreisverkehr | [`europe/`](europe/) |
| 🇺🇸 Alaska | right | planned | — |

## What every map contains

- `out/<map>.glb`: the map in metres, Y-up, chunked into 200 m tiles. glTF `extras` carry `nbs_collision` (true/false) and `nbs_surface` on every mesh.
- `out/<map>.blend`: the editable Blender scene, with packed textures, cameras, sun/sky, the route as a helper curve, and a reference bus.
- `out/<map>_route.json`: contains:
  - the spawn point and route polyline
  - stops, with the kerb side and door side
  - roundabouts and signalised junctions
  - every road's centreline, lanes, widths and speed

  Points are given in both Blender and glTF coordinates.
- `out/previews/`: renders, `topdown.jpg` (usable as a minimap) and `route_map.jpg`.

## Shared code

| File | What it does |
|---|---|
| `common/nbs_kit.py` | Mesh batching, materials, primitive helpers, glTF export and preview rendering. |
| `common/nbs_city.py` | The curved-road engine, for left- or right-hand traffic: <ul><li>junction detection</li><li>road, footpath and median surfaces with kerbs</li><li>markings (zebra, ladder, two-way-left-turn lane, bike lanes)</li><li>lot placement and back-lot infill</li><li>route legs, roundabout arcs, kerb-side stops and lane cameras</li><li>the route JSON</li></ul> |
| `common/nbs_tex.py` | Procedural texture helpers. |
| `common/route_map.py` | Draws the route and stops over the top-down render. |
| `common/fonts/NotoSans.ttf` | Latin font (SIL OFL). Kannada and Simplified Chinese Noto fonts live with their maps; the Chinese one is downloaded on demand. |

## Rebuilding

The Japan map runs with plain Blender. The other maps also need **shapely** in Blender's Python:

```bash
# macOS, Blender 5.2
/Applications/Blender.app/Contents/Resources/5.2/python/bin/python3.13 -m pip install shapely pillow
cd bus-sim-maps/<map>
/Applications/Blender.app/Contents/MacOS/Blender -b -P build_<map>.py -- --render
```

Alternatively, `pip install bpy shapely pillow numpy` in a Python 3.13 virtualenv and run `python build_<map>.py -- --render`. That is how the committed files were produced.
