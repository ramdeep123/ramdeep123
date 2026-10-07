# NammaBusSim world maps

Each country map is generated in Blender by a script. Shared geometry code lives in [`common/nbs_kit.py`](common/nbs_kit.py). That keeps the map reproducible and easy to tweak, and lets it export as a game-ready `.glb` plus a bus-route JSON.

| Map | Status | Traffic | Folder |
|---|---|---|---|
| 🇯🇵 Japan — Sakuragaoka, Tokyo-style | ✅ first pass | left | [`japan/`](japan/) |
| 🇨🇳 China | planned | right | — |
| 🇮🇳 India — Mallige Nagar, Bengaluru-style (curved roads, circle, metro) | ✅ first pass | left | [`india/`](india/) |
| 🇺🇸 United States | planned | right | — |
| 🇨🇦 Canada | planned | right | — |
| 🇩🇪 Germany | planned | right | — |
| 🇺🇸 Alaska | planned | right | — |

Every map follows the same layout, so the game can load any of them the same way:

- `out/<map>.glb`: the map in metres, Y-up, with the collision flags in glTF `extras`
- `out/<map>.blend`: the editable Blender scene
- `out/<map>_route.json`: spawn point, route polyline, stops (with the side the doors open on) and the road table
- `out/previews/`: renders, including a top-down minimap
