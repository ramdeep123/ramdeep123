// NammaBusSim map data: parses <map>_route.json (schema_version 2) produced by the Blender map generators.
// Requires the Newtonsoft Json package: com.unity.nuget.newtonsoft-json
//
// All 2D points in the JSON are Blender ground coordinates: x = east, y = north (metres).
// Convert them to Unity with NbsCoords.ToUnity(...).

using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace NammaBusSim.Maps
{
    public enum TrafficSide { Left, Right }

    /// <summary>How the glTF importer converted glTF's right-handed axes to Unity's.</summary>
    public enum GltfImporterAxis
    {
        /// <summary>Unity glTFast (com.unity.cloud.gltfast) negates X.</summary>
        GLTFast_FlipX,
        /// <summary>UnityGLTF (Khronos) negates Z.</summary>
        UnityGLTF_FlipZ
    }

    public static class NbsCoords
    {
        /// <summary>Blender ground point (x east, y north) + height -> Unity local position under the map root.</summary>
        public static Vector3 ToUnity(Vector2 b, float height, GltfImporterAxis axis)
        {
            return axis == GltfImporterAxis.GLTFast_FlipX
                ? new Vector3(-b.x, height, -b.y)
                : new Vector3(b.x, height, b.y);
        }

        /// <summary>Blender ground direction -> Unity local direction (normalised, y = 0).</summary>
        public static Vector3 DirToUnity(Vector2 d, GltfImporterAxis axis)
        {
            Vector3 v = ToUnity(d, 0f, axis);
            return v.sqrMagnitude > 1e-8f ? v.normalized : Vector3.forward;
        }
    }

    public class NbsStop
    {
        public string NameLocal;
        public string NameEn;
        public string DoorSide;          // "left" or "right"
        public Vector2 StopPoint;        // Blender x,y - where the bus front door should stop (kerb lane)
        public Vector2 Heading;          // Blender direction of travel at the stop
        public float RouteDistance;      // metres along the route from the start
        public int RouteIndex;
    }

    public class NbsRoundabout
    {
        public Vector2 Center;
        public float IslandRadius;
        public float OuterRadius;
        public string Direction;         // "clockwise" (left-hand traffic) or "counter-clockwise"
        public string Name;
    }

    public class NbsRoad
    {
        public string Id, NameLocal, NameEn, Class;
        public float CarriagewayWidth, FootpathWidth, MedianWidth, LaneWidth, SpeedKmh;
        public int LanesPerDirection;
        public List<Vector2> Centerline = new List<Vector2>();
    }

    public class NbsRouteData
    {
        public string MapId, Country, City;
        public TrafficSide Traffic;
        public Vector2 SpawnPoint;
        public float SpawnHeadingDeg;    // degrees counter-clockwise from east (Blender ground plane)
        public string RouteNumber, RouteNameLocal, RouteNameEn;
        public float RouteLength;
        public List<Vector2> RoutePoints = new List<Vector2>();
        public List<NbsStop> Stops = new List<NbsStop>();
        public List<NbsRoundabout> Roundabouts = new List<NbsRoundabout>();
        public List<Vector2> SignalisedJunctions = new List<Vector2>();
        public List<NbsRoad> Roads = new List<NbsRoad>();
        public string SpeedUnits = "kmh";

        public Vector2 SpawnHeading => new Vector2(Mathf.Cos(SpawnHeadingDeg * Mathf.Deg2Rad), Mathf.Sin(SpawnHeadingDeg * Mathf.Deg2Rad));

        static Vector2 V2(JToken t) => t == null ? Vector2.zero : new Vector2((float)t[0], (float)t[1]);
        static string S(JToken t) => t == null ? "" : (string)t;
        static float F(JToken t, float d = 0f) => t == null || t.Type == JTokenType.Null ? d : (float)t;

        public static NbsRouteData Parse(string json)
        {
            var o = JObject.Parse(json);
            var d = new NbsRouteData
            {
                MapId = S(o["map"]),
                Country = S(o["country"]),
                City = S(o["city"]),
                Traffic = S(o["traffic"]).StartsWith("left") ? TrafficSide.Left : TrafficSide.Right,
                SpeedUnits = o["speed_units"] != null ? S(o["speed_units"]) : "kmh",
            };
            var spawn = o["spawn"];
            d.SpawnPoint = V2(spawn["position"]);
            d.SpawnHeadingDeg = F(spawn["heading_deg_from_east"]);

            var route = o["route"];
            d.RouteNumber = S(route["number"]);
            d.RouteNameLocal = S(route["name_local"]);
            d.RouteNameEn = S(route["name_en"]);
            d.RouteLength = F(route["length_m"]);
            foreach (var p in route["points"]) d.RoutePoints.Add(V2(p));

            foreach (var s in o["stops"])
            {
                d.Stops.Add(new NbsStop
                {
                    NameLocal = S(s["name_local"]),
                    NameEn = S(s["name_en"]),
                    DoorSide = S(s["door_side"]),
                    StopPoint = V2(s["stop_point"]),
                    Heading = s["heading"] != null ? V2(s["heading"]) : Vector2.right,
                    RouteDistance = F(s["route_distance_m"]),
                    RouteIndex = s["route_index"] != null ? (int)s["route_index"] : 0,
                });
            }
            if (o["roundabouts"] != null)
                foreach (var r in o["roundabouts"])
                    d.Roundabouts.Add(new NbsRoundabout
                    {
                        Center = V2(r["center"]),
                        IslandRadius = F(r["island_radius_m"]),
                        OuterRadius = F(r["outer_radius_m"]),
                        Direction = S(r["direction"]),
                        Name = S(r["name_en"]),
                    });
            if (o["signalised_junctions"] != null)
                foreach (var j in o["signalised_junctions"]) d.SignalisedJunctions.Add(V2(j));
            if (o["roads"] != null)
                foreach (var r in o["roads"])
                {
                    var road = new NbsRoad
                    {
                        Id = S(r["id"]),
                        NameLocal = S(r["name_local"]),
                        NameEn = S(r["name_en"]),
                        Class = S(r["cls"]),
                        CarriagewayWidth = F(r["carriageway_m"]),
                        FootpathWidth = F(r["footpath_m"] ?? r["sidewalk_m"]),
                        MedianWidth = F(r["median_m"]),
                        LaneWidth = F(r["lane_width_m"]),
                        LanesPerDirection = r["lanes_per_direction"] != null ? (int)r["lanes_per_direction"] : 1,
                        SpeedKmh = F(r["speed_kmh"], 50f),
                    };
                    if (r["centerline"] != null)
                        foreach (var p in r["centerline"]) road.Centerline.Add(V2(p));
                    d.Roads.Add(road);
                }
            return d;
        }
    }
}
