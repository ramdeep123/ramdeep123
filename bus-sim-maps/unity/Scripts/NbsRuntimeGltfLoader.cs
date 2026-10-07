// OPTIONAL: download a map .glb at runtime (e.g. straight from the GitHub links) with Unity glTFast,
// then hand it to NbsMapLoader. Requires com.unity.cloud.gltfast (6.x).
// For shipping builds prefer importing the .glb in the Editor (smaller downloads, baked colliders).

#if NBS_GLTFAST
using System.Threading.Tasks;
using GLTFast;
using UnityEngine;

namespace NammaBusSim.Maps
{
    public class NbsRuntimeGltfLoader : MonoBehaviour
    {
        public string glbUrl = "https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps/usa/out/usa_palm_valley.glb";
        public NbsMapLoader loader;     // assign routeJson on it, leave mapPrefab empty

        async void Start()
        {
            if (loader == null) loader = GetComponent<NbsMapLoader>();
            var root = new GameObject("Map").transform;
            root.SetParent(loader.transform, false);
            var gltf = new GltfImport();
            bool ok = await gltf.Load(glbUrl);
            if (!ok) { Debug.LogError("[NbsRuntimeGltfLoader] Failed to load " + glbUrl); return; }
            await gltf.InstantiateMainSceneAsync(root);
            loader.mapRoot = root;
            loader.Build();
        }
    }
}
#endif
