"""Divide nomes e descrições do SRD em lotes para tradução.

Uso: python split_for_translation.py fonte/srd52.en.json <pasta-de-saida>
Gera nomes.en.json (todos os nomes e títulos) e loteNN-<grupo>.en.json (descrições, ~11 mil palavras cada).
Descrições de itens mágicos ficam de fora (só o nome é traduzido).
"""
import json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
D = json.load(open(SRC))["docs"]

names = {}
for k, v in D.items():
    names[k] = {"name": v["name"], "kind": v["type"] if v["pack"] != "equipment24" else "item"}
    adv = {a["id"]: a["title"] for a in v.get("advancement", []) if a.get("title")}
    if adv:
        names[k]["adv"] = adv
json.dump(names, open(os.path.join(OUT, "nomes.en.json"), "w"), ensure_ascii=False, indent=1)


def words(v):
    text = v.get("description", "") + " ".join(a.get("hint", "") for a in v.get("advancement", []))
    return len(re.sub("<[^>]+>", " ", text).split())


def entry(v):
    e = {"description": v.get("description", ""),
         "adv_hint": {a["id"]: a["hint"] for a in v.get("advancement", []) if a.get("hint")},
         "materials": v.get("materials"), "requirements": v.get("requirements")}
    return {x: y for x, y in e.items() if y}


groups = {"classes": [], "origens": [], "magias": [], "equip": []}
for k, v in D.items():
    if v["pack"] == "equipment24":
        if not v.get("rarity"):
            groups["equip"].append(k)
    elif v["pack"] == "spells24":
        groups["magias"].append(k)
    elif v["pack"] == "classes24":
        groups["classes"].append(k)
    else:
        groups["origens"].append(k)

lots = []
for group, ids in groups.items():
    current, total = [], 0
    for k in sorted(ids):
        if current and total + words(D[k]) > 11000:
            lots.append((group, current))
            current, total = [], 0
        current.append(k)
        total += words(D[k])
    if current:
        lots.append((group, current))

for i, (group, ids) in enumerate(lots, 1):
    out = {k: entry(D[k]) for k in ids if entry(D[k])}
    json.dump(out, open(os.path.join(OUT, f"lote{i:02d}-{group}.en.json"), "w"), ensure_ascii=False, indent=1)
    print(f"lote{i:02d}-{group}", len(out), sum(words(D[k]) for k in ids))
