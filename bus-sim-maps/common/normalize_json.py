"""Bring every map's route JSON to the common schema and write maps_manifest.json.

    python common/normalize_json.py

Only adds fields (older field names such as name_ja / name_kn are kept), so it is
safe to run repeatedly. Fields every map ends up with:
  map, country, traffic ("left-hand"|"right-hand"), units, spawn.position (Blender
  x,y,z), spawn.heading_deg_from_east, route.points (Blender x,y), stops[] with
  name_local, name_en, stop_point, heading, door_side, roundabouts[], signalised_junctions[]
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_RAW = "https://github.com/ramdeep123/ramdeep123/raw/claude/fervent-lamport-dtq4sy/bus-sim-maps"
MAPS = [
    ("japan", "japan_sakuragaoka", "Japan", "Sakuragaoka (Tokyo-style)"),
    ("india", "india_mallige_nagar", "India", "Mallige Nagar (Bengaluru-style)"),
    ("china", "china_jinhe", "China", "Jinhe New District"),
    ("canada", "canada_maplewood", "Canada", "Maplewood (Toronto-inspired)"),
    ("usa", "usa_palm_valley", "USA", "Palm Valley (SoCal-inspired)"),
    ("europe", "europe_lindenfeld", "Germany", "Lindenfeld (German old town)"),
]


def main():
    manifest = []
    for folder, name, country, title in MAPS:
        path = os.path.join(ROOT, folder, "out", name + "_route.json")
        d = json.load(open(path, encoding="utf-8"))
        d.setdefault("map", name)
        d.setdefault("country", country)
        d["schema_version"] = 2
        left = d.get("traffic", "").startswith("left")
        for st in d.get("stops", []):
            st.setdefault("name_local", st.get("name_ja") or st.get("name_kn") or "")
            st.setdefault("door_side", "left" if left else "right")
            if "heading" not in st:
                st["heading"] = [1.0, 0.0]
        if "roundabout" in d and "roundabouts" not in d:
            rb = dict(d["roundabout"])
            rb.setdefault("name_local", rb.get("name_kn", ""))
            d["roundabouts"] = [rb]
        d.setdefault("roundabouts", [])
        d.setdefault("signalised_junctions", [])
        r = d["route"]
        r.setdefault("name_local", r.get("name_ja") or r.get("name_kn") or "")
        r.setdefault("number", "")
        sp = d["spawn"]
        if "heading_deg_from_east" not in sp:
            st0 = d["stops"][0]
            sp["heading_deg_from_east"] = round(math.degrees(math.atan2(st0["heading"][1], st0["heading"][0])), 1)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        base = f"{REPO_RAW}/{folder}/out/{name}"
        manifest.append(dict(
            id=name, country=country, title=title, traffic=d["traffic"],
            route_number=r.get("number", ""), route_length_m=r["length_m"], stops=len(d["stops"]),
            glb_url=base + ".glb", route_json_url=base + "_route.json", blend_url=base + ".blend",
            route_map_url=f"{REPO_RAW}/{folder}/out/previews/route_map.jpg",
            topdown_url=f"{REPO_RAW}/{folder}/out/previews/topdown.jpg",
            glb_mb=round(os.path.getsize(os.path.join(ROOT, folder, "out", name + ".glb")) / 1e6, 1),
        ))
        print("normalised", name)
    with open(os.path.join(ROOT, "maps_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(dict(branch="claude/fervent-lamport-dtq4sy", maps=manifest), f, ensure_ascii=False, indent=1)
    print("wrote maps_manifest.json")


if __name__ == "__main__":
    main()
