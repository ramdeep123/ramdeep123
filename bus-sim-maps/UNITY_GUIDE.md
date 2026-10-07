# NammaBusSim maps → Unity: integration guide

This guide is for putting the six generated city maps into the Unity bus simulator: a person, or another AI chat, can follow it directly. It covers:
- download links for every map
- the Unity packages to install
- the import steps
- the C# scripts that add colliders, find the bus route and stops, and spawn the bus

> **Branch:** everything lives on branch `claude/fervent-lamport-dtq4sy` of the public repo
> <https://github.com/ramdeep123/ramdeep123>, folder [`bus-sim-maps/`](https://github.com/ramdeep123/ramdeep123/tree/claude/fervent-lamport-dtq4sy/bus-sim-maps).
> If that branch is merged, replace `claude/fervent-lamport-dtq4sy` with `main` in every link below.

---

## 1. Download links

Every link below downloads the file directly; no login is needed. The same list is available as machine-readable JSON:
**[maps_manifest.json](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/maps_manifest.json)**

For each map, download at least the **.glb** (the 3D map) and the **route JSON** (route, stops and spawn). The `.blend` is only needed if you want to edit the map in Blender.

| # | Map | Traffic | Route | 3D map (.glb) | Route data (.json) | Blender (.blend) | Preview |
|---|---|---|---|---|---|---|---|
| 1 | 🇯🇵 Japan — Sakuragaoka (Tokyo-style) | **left** | Sakuragaoka Loop · 1.43 km · 6 stops | [japan_sakuragaoka.glb](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/japan/out/japan_sakuragaoka.glb) (47 MB) | [route.json](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/japan/out/japan_sakuragaoka_route.json) | [.blend](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/japan/out/japan_sakuragaoka.blend) (14 MB) | [map](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/japan/out/previews/route_map.jpg) |
| 2 | 🇮🇳 India — Mallige Nagar (Bengaluru-style) | **left** | 500 · 2.03 km · 5 stops | [india_mallige_nagar.glb](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/india/out/india_mallige_nagar.glb) (73 MB) | [route.json](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/india/out/india_mallige_nagar_route.json) | [.blend](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/india/out/india_mallige_nagar.blend) (21 MB) | [map](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/india/out/previews/route_map.jpg) |
| 3 | 🇨🇳 China — Jinhe New District | right | K8 · 1.44 km · 4 stops | [china_jinhe.glb](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/china/out/china_jinhe.glb) (37 MB) | [route.json](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/china/out/china_jinhe_route.json) | [.blend](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/china/out/china_jinhe.blend) (19 MB) | [map](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/china/out/previews/route_map.jpg) |
| 4 | 🇨🇦 Canada — Maplewood (Toronto-inspired) | right | 504 · 1.51 km · 5 stops | [canada_maplewood.glb](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/canada/out/canada_maplewood.glb) (21 MB) | [route.json](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/canada/out/canada_maplewood_route.json) | [.blend](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/canada/out/canada_maplewood.blend) (9 MB) | [map](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/canada/out/previews/route_map.jpg) |
| 5 | 🇺🇸 USA — Palm Valley (SoCal-inspired) | right | 42 · 1.77 km · 5 stops | [usa_palm_valley.glb](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/usa/out/usa_palm_valley.glb) (16 MB) | [route.json](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/usa/out/usa_palm_valley_route.json) | [.blend](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/usa/out/usa_palm_valley.blend) (7 MB) | [map](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/usa/out/previews/route_map.jpg) |
| 6 | 🇩🇪 Europe — Lindenfeld (German old town) | right | 17 · 2.25 km · 7 stops | [europe_lindenfeld.glb](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/europe/out/europe_lindenfeld.glb) (37 MB) | [route.json](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/europe/out/europe_lindenfeld_route.json) | [.blend](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/europe/out/europe_lindenfeld.blend) (17 MB) | [map](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/europe/out/previews/route_map.jpg) |

**Unity C# scripts** go in `Assets/NammaBusSim/Scripts/`:

| File | What it does |
|---|---|
| [NbsRouteData.cs](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/unity/Scripts/NbsRouteData.cs) | Parses the route JSON and converts coordinates. |
| [NbsMapLoader.cs](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/unity/Scripts/NbsMapLoader.cs) | Places the map, adds colliders, finds the route and spawn point, and creates the bus stops. |
| [NbsBusStop.cs](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/unity/Scripts/NbsBusStop.cs) | Stop trigger with enter/exit events. |
| [NbsBusTag.cs](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/unity/Scripts/NbsBusTag.cs) | Marks your bus so stops recognise it. |
| [NbsRouteFollower.cs](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/unity/Scripts/NbsRouteFollower.cs) | Test driver that drives the route and stops at the stops. |
| [NbsRuntimeGltfLoader.cs](https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/unity/Scripts/NbsRuntimeGltfLoader.cs) | Optional: downloads a .glb at runtime. |

**Everything in one zip:** [whole branch .zip](https://github.com/ramdeep123/ramdeep123/archive/refs/heads/claude/fervent-lamport-dtq4sy.zip). It is large (about 400 MB) because it includes all the .blend files and the other app in the repo.

### Downloading from a terminal

```bash
B=https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps
mkdir -p Assets/NammaBusSim/Maps Assets/NammaBusSim/Scripts
for m in japan/japan_sakuragaoka india/india_mallige_nagar china/china_jinhe canada/canada_maplewood usa/usa_palm_valley europe/europe_lindenfeld; do
  d=${m%%/*}; n=${m##*/}; mkdir -p Assets/NammaBusSim/Maps/$n
  curl -L -o Assets/NammaBusSim/Maps/$n/$n.glb        "$B/$d/out/$n.glb"
  curl -L -o Assets/NammaBusSim/Maps/$n/${n}_route.json "$B/$d/out/${n}_route.json"
done
for f in NbsRouteData NbsMapLoader NbsBusStop NbsBusTag NbsRouteFollower NbsRuntimeGltfLoader; do
  curl -L -o Assets/NammaBusSim/Scripts/$f.cs "$B/unity/Scripts/$f.cs"
done
```

---

## 2. Unity project setup (one time)

**Unity version:** Unity 2022.3 LTS or Unity 6. The maps work with the Built-in render pipeline, URP and HDRP.

**Packages:** open *Window → Package Manager → + → Add package by name…* and add:

| Package | Why |
|---|---|
| `com.unity.cloud.gltfast` | Imports `.glb` files. This is Unity's official glTF importer. |
| `com.unity.nuget.newtonsoft-json` | The route JSON parser uses it. |

Or add them to `Packages/manifest.json`. Use the latest 6.x version of glTFast that the Package Manager offers for your Unity version:

```json
"com.unity.cloud.gltfast": "6.10.1",
"com.unity.nuget.newtonsoft-json": "3.2.1"
```

**Tag:** create a tag **`Bus`** (*Project Settings → Tags and Layers*). Alternatively, add the `NbsBusTag` component to your bus.

---

## 3. Importing one map (repeat for each map)

1. **Copy the files** into `Assets/NammaBusSim/Maps/<map_id>/`:
   - `<map_id>.glb`
   - `<map_id>_route.json`

   Unity imports the `.glb` as a prefab via glTFast. The bigger maps take 1–3 minutes.
   - The JSON shows up as a **TextAsset**.
   - Keep import scale at **1**; the maps are in metres.
2. **Create the map object:**
   1. Create a new scene, or open your simulator's map scene.
   2. Add an empty GameObject named `Map_<map_id>` at position (0,0,0), rotation 0, scale 1.
   3. Add the **NbsMapLoader** component to it.
3. **Fill in the loader:**
   - **Map Prefab:** drag the imported `.glb` asset.
   - **Route Json:** drag `<map_id>_route.json`.
   - **Bus Prefab:** your existing simulator bus. It needs a Rigidbody, colliders and the `Bus` tag.
   - Leave **Auto Detect Axis** on.
4. **Bake it:** right-click the NbsMapLoader component header and choose **Build now (in editor)**. This instantiates the map as a child `Map`, adds MeshColliders, creates the `BusStops` triggers, and draws the route as orange gizmos.
5. **Save the scene.** The colliders are now baked into the scene, which is the most reliable option for builds.
6. **Light the scene:**
   - Add a *Directional Light* (sun), at about 40–50° elevation.
   - Use a procedural skybox.
   - Optionally add distance fog to soften the horizon.
   - The maps contain no lights or cameras.
7. **Set the camera far clip:** at least **3000 m**. For the USA map, use 30000 m to see the mountains, or delete its `Backdrop_mountain_*` objects.
8. **Press Play.**
   - The bus spawns at the route start: a station berth or terminal, facing the direction of travel.
   - The Console prints the map, traffic side, route and number of stops.
   - To test without your vehicle physics, add **NbsRouteFollower** to any object. It drives the whole loop and waits at every stop.

### What the loader gives your simulator code

```csharp
var map = FindFirstObjectByType<NammaBusSim.Maps.NbsMapLoader>();
map.Data.Traffic            // TrafficSide.Left (Japan, India) or Right (China, Canada, USA, Europe)
map.Data.RouteNumber        // "500", "K8", "504", "42", "17"
map.RouteWorld              // List<Vector3>: bus route, ~2 m spacing, closed loop, already on the road surface
map.StopObjects             // List<NbsBusStop>: trigger boxes; .nameLocal / .nameEn / .doorSide / .routeDistance
map.SpawnWorld, map.SpawnRotation
map.Data.Roundabouts        // centre + radii + direction (clockwise for left-hand, counter-clockwise for right-hand)
map.Data.SignalisedJunctions// junction centres that have traffic lights (Blender x,y -> use map.Ground(p))
map.Data.Roads              // every road: centreline, lanes per direction, lane width, median, speed limit
map.Ground(blenderXY)       // convert any JSON point to a Unity world point on the road surface
```

Listening for the bus at stops:

```csharp
foreach (var stop in map.StopObjects)
    stop.onBusEnter.AddListener((s, bus) => Debug.Log($"Arrived at {s} - open {s.doorSide} doors"));
```

---

## 4. Rules per map that the simulator must respect

| Map | Drive on | Bus doors | Roundabout direction | Speed units |
|---|---|---|---|---|
| Japan | left | left | — | km/h |
| India | left | left | clockwise (*Mallige Circle*) | km/h |
| China | right | right | — | km/h |
| Canada | right | right | — | km/h |
| USA | right | right | — | **mph** (`speed_units: "mph"` in the JSON) |
| Europe (DE) | right | right | counter-clockwise (*Kreisverkehr West*) | km/h |

If your bus model has its doors on one side only, mirror it (or swap the door animation side) for left-hand-traffic maps.

---

## 5. How the files are organised

### GLB structure

Every mesh is named `<Collection>_<material>_<chunkX>_<chunkY>`, for example `Roads_asphalt_2_3`. The world is cut into **200 m chunks**, which helps occlusion culling and streaming. Each mesh also carries glTF `extras` (`nbs_collision`, `nbs_surface`) if your importer keeps them.

| Collection prefix | Collider? | Contents |
|---|---|---|
| `Roads` | ✔ | Asphalt, cobbles, medians, kerb faces. Use as the drive surface. |
| `Sidewalks` / `Footpaths` | ✔ | Raised 14–20 cm with kerbs. |
| `Buildings`, `Landmark`, `Station`, `Temple`, `Depot`, `Metro`, `Railway`, `Expressway`, `Freeway` | ✔ | Solid. |
| `Terrain`, `Lots`, `Plaza`, `Islands`, `Circle`, `Lake`, `River` | ✔ | Ground, parking lots, squares, roundabout islands, water banks. |
| `Markings` | ✘ | Paint, a few mm above the road. |
| `Props`, `Vegetation`, `Vehicles` | optional (`collidersOnProps`) | Poles, signs, signals, trees, parked cars. |
| `Wires`, `Backdrop` | ✘ | Overhead wires, distant ground and mountains. |

### Coordinates

- The route JSON stores 2D points in **Blender ground coordinates**: `x = east`, `y = north`, in metres.
- glTF and Unity are Y-up. Unity glTFast converts by flipping X, so a JSON point `(x, y)` becomes Unity `(-x, height, -y)`. UnityGLTF flips Z, so the same point becomes `(x, height, y)`.
- `NbsCoords` handles both conversions, and `NbsMapLoader` **auto-detects** which one is in use. It does this by ray-casting the spawn and route points onto the `Roads` colliders.
- The JSON also contains `*_gltf` versions of key points (`[x, z, -y]`).

### Route JSON (schema_version 2, abridged)

```jsonc
{
  "map": "usa_palm_valley", "country": "USA", "traffic": "right-hand", "units": "metres",
  "spawn": { "position": [x, y, 0], "heading_deg_from_east": 92.3 },
  "route": { "number": "42", "name_en": "Mission - Foothill", "loop": true, "length_m": 1766.1,
             "points": [[x, y], ...] },                         // ~2 m spacing, in the kerb-side lane
  "stops": [ { "name_local": "...", "name_en": "...", "stop_point": [x, y], "heading": [dx, dy],
               "door_side": "right", "route_index": 0, "route_distance_m": 0.0 }, ... ],
  "roundabouts": [ { "center": [x, y], "island_radius_m": 9, "outer_radius_m": 17, "direction": "counter-clockwise" } ],
  "signalised_junctions": [[x, y], ...],
  "roads": [ { "id": "MISSION", "name_en": "Mission Blvd", "cls": "stroad", "carriageway_m": 28.8,
               "lanes_per_direction": 3, "lane_width_m": 3.6, "median_m": 4.2, "speed_kmh": 40,
               "centerline": [[x, y], ...] }, ... ]
}
```

---

## 6. Performance

| Map | Faces (approx.) | GLB |
|---|---|---|
| Japan | 435 k | 47 MB |
| India | 585 k | 73 MB |
| China | 632 k | 37 MB |
| Canada | 254 k | 21 MB |
| USA | 147 k | 16 MB |
| Europe | 560 k | 37 MB |

- **Static flags:** keep **Mark Static** on in the loader. Then bake *Occlusion Culling* (*Window → Rendering → Occlusion Culling → Bake*). The 200 m chunks cull well.
- **Textures:** set them to compress (ASTC on mobile, DXT/BC on desktop). Most are 1024 px; you can drop them to 512 for mobile.
- **Mobile:** use the camera far clip and fog to hide the outer ring of low-detail buildings. Alternatively, delete the outer chunks; chunk indices away from the centre hold only simple "lite" buildings.
- **Colliders:** only the collision collections get MeshColliders. If you need props to collide, prefer simple Box/Capsule colliders on poles over `collidersOnProps`.

---

## 7. Replacing the maps in an existing simulator

- **One scene per map** (`Map_Japan.unity`, `Map_India.unity` …), each containing its `NbsMapLoader`.
- Your menu loads the chosen scene with `SceneManager.LoadScene(...)`. Or keep the bus and UI in a base scene and load the map scene additively.
- Read `maps_manifest.json` for the list of maps, titles, traffic side and download URLs. Use it to build the map-selection menu, or to download maps on demand with `NbsRuntimeGltfLoader`.
- Remove or disable the old map's road, collider and route objects. The new map brings its own colliders, route and stops.
- If your old code used hard-coded waypoints, replace them with `map.RouteWorld`. If it used hard-coded stop positions, use `map.StopObjects`.

**Downloading maps at runtime instead of importing them:**
1. Add `NBS_GLTFAST` to *Project Settings → Player → Scripting Define Symbols*.
2. Put `NbsRuntimeGltfLoader` and `NbsMapLoader` on the same object.
3. Set `glbUrl` to one of the links above, assign `routeJson`, and leave `mapPrefab` empty.

> Runtime-loaded meshes may not be readable for MeshColliders on some platforms. If colliders fail, use the editor import path from section 3.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Console: *"Axis auto-detect found no road…"* | Colliders are missing. Leave **Add Colliders** on, or check that node names still start with `Roads_` (importer naming setting). |
| Bus spawns off the road or facing backwards | Untick **Auto Detect Axis** and switch **Axis** between `GLTFast_FlipX` and `UnityGLTF_FlipZ`. |
| Pink/magenta materials | The render pipeline doesn't match glTFast's shaders. Reimport the `.glb` after switching pipelines. For runtime loading, add glTFast's shader variants to *Graphics → Always Included Shaders*. |
| "Mesh is not readable" when adding MeshColliders | Use **Build now (in editor)** and save the scene, or enable Read/Write in the glTF import settings if your importer offers it. |
| Signs or road text have black edges | Set alpha materials to *Cutout/Alpha Test* in your pipeline. glTFast imports them as *Blend*. |
| Flickering roads far away | Raise the camera near clip (0.3 → 0.5) or lower the far clip. |
| Very long import | The India and Japan GLBs are the largest. Import them once and commit the generated prefab/Library to your own project, or use the runtime loader. |

---

## 9. Prompt to paste into the other chat

> I'm replacing the maps in my Unity bus simulator (NammaBusSim) with 6 generated city maps.
>
> Please read this guide first and follow it exactly:
> https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/UNITY_GUIDE.md
>
> - The machine-readable list of maps with all download links is at
>   https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/maps_manifest.json
> - Each map comes as:
>   - a `.glb` (import with Unity glTFast)
>   - a `_route.json` with the spawn point, a closed bus-route polyline, stops (with door side), roundabouts, signals and road data
> - Ready-made scripts are in `bus-sim-maps/unity/Scripts/`:
>   - `NbsMapLoader` adds colliders, auto-detects the glTF axis convention, converts the route and stops to Unity, creates stop triggers, and spawns the bus.
>   - `NbsRouteData` parses the route JSON; `NbsBusStop` and `NbsBusTag` handle the stop triggers.
>   - `NbsRouteFollower` is a test driver.
> - Japan and India are **left-hand traffic** (doors on the left). China, Canada, USA and Germany are **right-hand traffic**. The USA uses mph.
>
> Help me do the following:
> 1. Add the packages `com.unity.cloud.gltfast` and `com.unity.nuget.newtonsoft-json`.
> 2. Create one scene per map using `NbsMapLoader`.
> 3. Hook my existing bus prefab (tag `Bus`) to the spawn point and stops.
> 4. Replace my old hard-coded waypoints and stops with `map.RouteWorld` and `map.StopObjects`.
> 5. Make a map-selection menu from `maps_manifest.json`.
