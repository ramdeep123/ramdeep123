// Simple test driver: moves a transform (e.g. a bus or an AI bus) along the map's bus route,
// slows down and waits at every stop. Useful to check a freshly imported map before wiring up
// your real vehicle physics.

using UnityEngine;

namespace NammaBusSim.Maps
{
    public class NbsRouteFollower : MonoBehaviour
    {
        public NbsMapLoader map;
        [Tooltip("Cruise speed in km/h.")] public float cruiseKmh = 35f;
        [Tooltip("Seconds to wait at each stop.")] public float dwellSeconds = 6f;
        public float lookAhead = 6f;
        public bool startAtSpawn = true;

        int target;
        float wait;
        int nextStop;

        void Start()
        {
            if (map == null) map = FindFirstObjectByType<NbsMapLoader>();
            if (map == null || map.RouteWorld.Count < 2) { enabled = false; return; }
            if (startAtSpawn) transform.SetPositionAndRotation(map.SpawnWorld, map.SpawnRotation);
            target = ClosestIndex(transform.position);
            nextStop = 0;
        }

        int ClosestIndex(Vector3 p)
        {
            int best = 0;
            float bd = float.MaxValue;
            for (int i = 0; i < map.RouteWorld.Count; i++)
            {
                float d = (map.RouteWorld[i] - p).sqrMagnitude;
                if (d < bd) { bd = d; best = i; }
            }
            return best;
        }

        void Update()
        {
            var route = map.RouteWorld;
            if (wait > 0) { wait -= Time.deltaTime; return; }

            // advance the look-ahead target
            while ((route[target] - transform.position).magnitude < lookAhead)
                target = (target + 1) % route.Count;

            float speed = cruiseKmh / 3.6f;
            if (map.StopObjects.Count > 0)
            {
                var stop = map.StopObjects[nextStop % map.StopObjects.Count];
                float d = Vector3.Distance(transform.position, stop.transform.position);
                if (d < 25f) speed *= Mathf.Clamp01(d / 25f) + 0.1f;
                if (d < 1.5f)
                {
                    wait = dwellSeconds;
                    nextStop++;
                }
            }

            Vector3 dir = route[target] - transform.position;
            dir.y = 0;
            if (dir.sqrMagnitude > 0.01f)
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(dir, Vector3.up), Time.deltaTime * 3f);
            transform.position += transform.forward * speed * Time.deltaTime;
            var p = transform.position;
            // short ray (never jumps onto decks overhead) that ignores the vehicle's own colliders
            float best = float.MaxValue, groundY = p.y;
            foreach (var hit in Physics.RaycastAll(p + Vector3.up * 1.5f, Vector3.down, 6f, ~0, QueryTriggerInteraction.Ignore))
            {
                if (hit.collider.transform.IsChildOf(transform) || hit.distance >= best) continue;   // RaycastAll is unordered
                best = hit.distance;
                groundY = hit.point.y;
            }
            transform.position = new Vector3(p.x, groundY, p.z);
        }
    }
}
