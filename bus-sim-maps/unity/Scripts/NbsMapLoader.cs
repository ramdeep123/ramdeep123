// NammaBusSim map loader for Unity.
//
// Put the imported .glb map (prefab from glTFast / UnityGLTF) and its <map>_route.json (TextAsset)
// on this component. It:
//   1. instantiates the map (or uses an existing child called "Map"),
//   2. adds MeshColliders to the collision meshes (roads, footpaths, buildings, ...) and marks them static,
//   3. works out which axis convention the glTF importer used (auto-detect by ray-casting the spawn point),
//   4. converts the bus route, stops, roundabouts and signal positions to Unity world space,
//   5. creates a trigger box at every bus stop (NbsBusStop) and spawns your bus at the spawn point.
//
// Tip: right-click the component header -> "Build now (in editor)" and save the scene, so colliders are
// baked into the scene instead of being generated at runtime.

using System.Collections.Generic;
using UnityEngine;

namespace NammaBusSim.Maps
{
    [DefaultExecutionOrder(-100)]
    public class NbsMapLoader : MonoBehaviour
    {
        [Header("Inputs")]
        [Tooltip("Prefab created when you import <map>.glb (drag the .glb asset here). Leave empty if the map is already a child named 'Map'.")]
        public GameObject mapPrefab;
        [Tooltip("<map>_route.json from the same map folder.")]
        public TextAsset routeJson;

        [Header("Import axis")]
        public bool autoDetectAxis = true;
        public GltfImporterAxis axis = GltfImporterAxis.GLTFast_FlipX;

        [Header("Physics")]
        public bool addColliders = true;
        [Tooltip("Also add colliders to poles, signs, trees, parked cars (more expensive).")]
        public bool collidersOnProps = false;
        public bool markStatic = true;

        [Header("Bus")]
        public bool spawnBus = true;
        public GameObject busPrefab;
        [Tooltip("Height above the road the bus pivot should be placed at.")]
        public float busPivotHeight = 0.0f;
        public bool createStopTriggers = true;
        public Vector3 stopTriggerSize = new Vector3(4f, 4f, 16f);   // width, height, length (along travel)

        [Header("Output (read-only at runtime)")]
        public Transform mapRoot;
        public Transform spawnedBus;

        public NbsRouteData Data { get; private set; }
        public List<Vector3> RouteWorld { get; } = new List<Vector3>();
        public List<NbsBusStop> StopObjects { get; } = new List<NbsBusStop>();
        public Vector3 SpawnWorld { get; private set; }
        public Quaternion SpawnRotation { get; private set; }

        // GLB node names start with the Blender collection name, e.g. "Roads_asphalt_2_3".
        static readonly string[] CollisionPrefixes =
        {
            "Roads", "Sidewalks", "Footpaths", "Buildings", "Terrain", "Station", "Railway", "Depot", "Metro", "Temple",
            "Circle", "Lake", "Landmark", "Expressway", "River", "Islands", "Lots", "Freeway", "Plaza"
        };
        static readonly string[] PropPrefixes = { "Props", "Vegetation", "Vehicles" };
        static readonly string[] SurfacePrefixes = { "Roads", "Plaza", "Lots", "Islands" };

        bool built;

        void Awake()
        {
            if (!built) Build();
        }

        [ContextMenu("Build now (in editor)")]
        public void Build()
        {
            if (routeJson == null)
            {
                Debug.LogError("[NbsMapLoader] Assign the map's _route.json TextAsset.");
                return;
            }
            Data = NbsRouteData.Parse(routeJson.text);

            if (mapRoot == null)
            {
                var existing = transform.Find("Map");
                if (existing != null) mapRoot = existing;
                else if (mapPrefab != null)
                {
                    mapRoot = Instantiate(mapPrefab, transform).transform;
                    mapRoot.name = "Map";
                    mapRoot.localPosition = Vector3.zero;
                    mapRoot.localRotation = Quaternion.identity;
                    mapRoot.localScale = Vector3.one;
                }
            }
            if (mapRoot == null)
            {
                Debug.LogError("[NbsMapLoader] No map: assign mapPrefab or add the imported map as a child named 'Map'.");
                return;
            }

            if (addColliders) AddColliders(mapRoot);
            if (autoDetectAxis) axis = DetectAxis();

            RouteWorld.Clear();
            foreach (var p in Data.RoutePoints) RouteWorld.Add(Ground(p));

            Vector3 fwd = mapRoot.TransformDirection(NbsCoords.DirToUnity(Data.SpawnHeading, axis));
            SpawnWorld = Ground(Data.SpawnPoint) + Vector3.up * busPivotHeight;
            SpawnRotation = Quaternion.LookRotation(fwd, Vector3.up);

            if (createStopTriggers) CreateStops();
            if (spawnBus && busPrefab != null && spawnedBus == null && Application.isPlaying)
                spawnedBus = Instantiate(busPrefab, SpawnWorld, SpawnRotation).transform;

            built = true;
            Debug.Log($"[NbsMapLoader] {Data.MapId}: {Data.Traffic}-hand traffic, route {Data.RouteNumber} " +
                      $"{Data.RouteLength:0} m, {Data.Stops.Count} stops, axis {axis}");
        }

        static bool StartsWithAny(string n, string[] prefixes)
        {
            foreach (var p in prefixes)
                if (n.StartsWith(p + "_") || n == p) return true;
            return false;
        }

        /// <summary>Importers may put the mesh on the glTF node or on a child of it - use whichever carries the Blender name.</summary>
        static string NodeName(Transform t)
        {
            for (int i = 0; i < 2 && t != null; i++, t = t.parent)
            {
                if (StartsWithAny(t.name, CollisionPrefixes) || StartsWithAny(t.name, PropPrefixes) || t.name.StartsWith("Markings") ||
                    t.name.StartsWith("Wires") || t.name.StartsWith("Backdrop"))
                    return t.name;
            }
            return t != null ? t.name : "";
        }

        void AddColliders(Transform root)
        {
            foreach (var mf in root.GetComponentsInChildren<MeshFilter>(true))
            {
                string n = NodeName(mf.transform);
                bool solid = StartsWithAny(n, CollisionPrefixes) || (collidersOnProps && StartsWithAny(n, PropPrefixes));
                if (markStatic) mf.gameObject.isStatic = true;
                if (!solid || mf.sharedMesh == null || mf.GetComponent<Collider>() != null) continue;
                var mc = mf.gameObject.AddComponent<MeshCollider>();
                mc.sharedMesh = mf.sharedMesh;
            }
            Physics.SyncTransforms();
        }

        /// <summary>Which axis convention puts the spawn point on a road surface?</summary>
        GltfImporterAxis DetectAxis()
        {
            float Score(GltfImporterAxis a)
            {
                float score = 0;
                var pts = new List<Vector2> { Data.SpawnPoint };
                for (int i = 0; i < Data.RoutePoints.Count; i += Mathf.Max(1, Data.RoutePoints.Count / 12)) pts.Add(Data.RoutePoints[i]);
                foreach (var p in pts)
                {
                    Vector3 g = mapRoot.TransformPoint(NbsCoords.ToUnity(p, 0f, a));
                    if (GroundHit(g, out var hit) && StartsWithAny(NodeName(hit.collider.transform), SurfacePrefixes))
                        score += 1;
                }
                return score;
            }
            float fx = Score(GltfImporterAxis.GLTFast_FlipX), fz = Score(GltfImporterAxis.UnityGLTF_FlipZ);
            if (fx == 0 && fz == 0)
            {
                Debug.LogWarning("[NbsMapLoader] Axis auto-detect found no road under the route (colliders missing?). Using " + axis);
                return axis;
            }
            return fz > fx ? GltfImporterAxis.UnityGLTF_FlipZ : GltfImporterAxis.GLTFast_FlipX;
        }

        /// <summary>Blender ground point -> Unity world point snapped down onto the surface below.</summary>
        public Vector3 Ground(Vector2 blenderXY)
        {
            Vector3 w = mapRoot.TransformPoint(NbsCoords.ToUnity(blenderXY, 0f, axis));
            return GroundHit(w, out var hit) ? hit.point : w;
        }

        /// <summary>
        /// Surface closest to ground level at w. Elevated decks (expressway, metro, freeway) are above the
        /// streets they cross, so the highest hit is not necessarily the road the bus drives on.
        /// </summary>
        static bool GroundHit(Vector3 w, out RaycastHit best)
        {
            best = default;
            var hits = Physics.RaycastAll(w + Vector3.up * 60f, Vector3.down, 120f, ~0, QueryTriggerInteraction.Ignore);
            float bestD = float.MaxValue;
            foreach (var h in hits)
            {
                float d = Mathf.Abs(h.point.y - w.y);
                if (d < bestD && d < 3f) { bestD = d; best = h; }
            }
            return bestD < float.MaxValue;
        }

        public Vector3 ToWorldDir(Vector2 blenderDir) => mapRoot.TransformDirection(NbsCoords.DirToUnity(blenderDir, axis));

        void CreateStops()
        {
            var holder = transform.Find("BusStops");
            if (holder != null)
            {
                if (Application.isPlaying) Destroy(holder.gameObject); else DestroyImmediate(holder.gameObject);
            }
            holder = new GameObject("BusStops").transform;
            holder.SetParent(transform, false);
            StopObjects.Clear();
            for (int i = 0; i < Data.Stops.Count; i++)
            {
                var s = Data.Stops[i];
                var go = new GameObject($"Stop_{i + 1:00}_{s.NameEn}");
                go.transform.SetParent(holder, false);
                Vector3 fwd = ToWorldDir(s.Heading);
                go.transform.SetPositionAndRotation(Ground(s.StopPoint) + Vector3.up * stopTriggerSize.y / 2, Quaternion.LookRotation(fwd, Vector3.up));
                var box = go.AddComponent<BoxCollider>();
                box.isTrigger = true;
                box.size = stopTriggerSize;
                box.center = new Vector3(0, 0, -stopTriggerSize.z * 0.35f);   // most of the box behind the stop point
                var stop = go.AddComponent<NbsBusStop>();
                stop.index = i;
                stop.nameLocal = s.NameLocal;
                stop.nameEn = s.NameEn;
                stop.doorSide = s.DoorSide;
                stop.routeDistance = s.RouteDistance;
                StopObjects.Add(stop);
            }
        }

        void OnDrawGizmos()
        {
            if (RouteWorld.Count < 2) return;
            Gizmos.color = new Color(1f, 0.4f, 0f);
            for (int i = 0; i < RouteWorld.Count; i++)
                Gizmos.DrawLine(RouteWorld[i] + Vector3.up * 0.5f, RouteWorld[(i + 1) % RouteWorld.Count] + Vector3.up * 0.5f);
            Gizmos.color = Color.cyan;
            foreach (var s in StopObjects)
                if (s != null) Gizmos.DrawWireSphere(s.transform.position, 1.5f);
            Gizmos.color = Color.green;
            Gizmos.DrawWireCube(SpawnWorld + Vector3.up, new Vector3(2.5f, 2f, 2.5f));
            Gizmos.DrawRay(SpawnWorld + Vector3.up, SpawnRotation * Vector3.forward * 8f);
        }
    }
}
