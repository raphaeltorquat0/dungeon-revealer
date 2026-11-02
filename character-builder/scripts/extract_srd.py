"""Extrai o conteúdo SRD 5.2 (CC-BY-4.0) dos pacotes YAML do sistema dnd5e do Foundry.

Uso: python extract_srd.py <dnd5e>/packs/_source <saida.json>
Só entram documentos com system.source.license == "CC-BY-4.0" (e as listas de magias).
"""
import glob, json, os, re, sys
import yaml

SRC, OUT = sys.argv[1], sys.argv[2]
PACKS = ["classes24", "origins24", "feats24", "spells24", "equipment24"]
UUID = re.compile(r"Compendium\.[\w-]+\.\w+\.Item\.(\w+)")


ABILITY = {"str": "Strength", "dex": "Dexterity", "con": "Constitution", "int": "Intelligence",
           "wis": "Wisdom", "cha": "Charisma"}
SKILL = {"acr": ("dex", "Acrobatics"), "ani": ("wis", "Animal Handling"), "arc": ("int", "Arcana"),
         "ath": ("str", "Athletics"), "dec": ("cha", "Deception"), "his": ("int", "History"),
         "ins": ("wis", "Insight"), "itm": ("cha", "Intimidation"), "inv": ("int", "Investigation"),
         "med": ("wis", "Medicine"), "nat": ("int", "Nature"), "prc": ("wis", "Perception"),
         "prf": ("cha", "Performance"), "per": ("cha", "Persuasion"), "rel": ("int", "Religion"),
         "slt": ("dex", "Sleight of Hand"), "ste": ("dex", "Stealth"), "sur": ("wis", "Survival")}
TOOL = {"thief": "Thieves' Tools", "herb": "Herbalism Kit", "pois": "Poisoner's Kit", "disg": "Disguise Kit"}


DEFAULT_DAMAGE = None


def enricher(kind, args):
    """Converte comandos do Foundry ([[/save ...]] etc.) em texto corrido, em inglês, para depois traduzir."""
    kv = dict(x.split("=", 1) for x in args.split() if "=" in x)
    pos = [x for x in args.split() if "=" not in x]
    dc = kv.get("dc") or next((x for x in pos if x.isdigit()), None)
    dc_text = ("against your spell save DC" if dc and dc.startswith("@") else None)
    prefix = f"DC {dc} " if dc and not dc_text else ""
    suffix = f" {dc_text}" if dc_text else ""
    if kind in ("r", "roll"):
        return re.sub(r"cs\d+", "", args).strip()
    if kind == "award":
        return re.sub(r"(\d+)\s*([A-Za-z]+)", r"\1 \2", args.strip()).upper().replace("GP", "GP")
    if kind in ("damage", "healing"):
        types = {"acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing",
                 "poison", "psychic", "radiant", "slashing", "thunder", "healing"}
        t = kv.get("type") or next((x for x in pos if x in types), "")
        formula = " ".join(x for x in pos if x not in types) or kv.get("formula", "")
        if not formula and DEFAULT_DAMAGE:  # [[/damage]] sem argumentos usa o dano da própria magia
            formula, t = DEFAULT_DAMAGE[0], t or DEFAULT_DAMAGE[1]
        return f"{formula} Hit Points" if kind == "healing" or t == "healing" else f"{formula} {t.capitalize()}"
    if kind == "save":
        ab = kv.get("ability") or next((x for x in pos if x in ABILITY), "")
        return f"{prefix}{ABILITY.get(ab, ab)} saving throw{suffix}"
    if kind in ("check", "skill"):
        sk = kv.get("skill") or next((x for x in pos if x in SKILL), None)
        ab = kv.get("ability") or (SKILL[sk][0] if sk in SKILL else next((x for x in pos if x in ABILITY), ""))
        label = f"{ABILITY.get(ab, ab)} ({SKILL[sk][1]})" if sk in SKILL else ABILITY.get(ab, ab)
        return f"{prefix}{label} check{suffix}"
    if kind == "tool":
        tool = pos[0] if pos else kv.get("tool", "")
        ab = kv.get("ability") or next((x for x in pos[1:] if x in ABILITY), "")
        return f"{prefix}{ABILITY.get(ab, ab)} check using {TOOL.get(tool, tool)}{suffix}".strip()
    if kind == "item":
        return args.strip()
    return args.strip()


def ref_id(uuid):
    m = UUID.search(uuid or "")
    return m.group(1) if m else None


def clean_html(html):
    if not html:
        return ""
    html = re.sub(r"<p>@Embed\[[^\]]*\]</p>|@Embed\[[^\]]*\]", "", html)
    html = re.sub(r"@UUID\[[^\]]*\]\{([^}]*)\}", r"\1", html)
    html = re.sub(r"@UUID\[[^\]]*\]", "", html)
    html = re.sub(r"\[\[/(\w+)\s*([^\]]*)\]\](?:\{([^}]*)\})?",
                  lambda m: m.group(3) or enricher(m.group(1), m.group(2)), html)
    html = re.sub(r"&(?:amp;)?(?:Reference|reference)\[([^\]\s]+)[^\]]*\](?:\{([^}]*)\})?",
                  lambda m: m.group(2) or m.group(1).split("=")[-1], html)
    return html.strip()


def advancement(system):
    adv = system.get("advancement") or []
    if isinstance(adv, dict):
        adv = list(adv.values())
    out = []
    for a in adv:
        cfg = dict(a.get("configuration") or {})
        if "items" in cfg:
            cfg["items"] = [ref_id(i["uuid"] if isinstance(i, dict) else i) for i in cfg["items"]]
            cfg["items"] = [i for i in cfg["items"] if i]
        if a["type"] == "ItemChoice" and "choices" in cfg and isinstance(cfg["choices"], dict):
            cfg["choices"] = {k: v.get("count") if isinstance(v, dict) else v for k, v in cfg["choices"].items()}
        if a["type"] == "ScaleValue":
            def scale_value(v):
                if not isinstance(v, dict):
                    return v
                if "faces" in v:  # dado: "d6" ou "3d6"
                    return f"{v.get('number') or ''}d{v['faces']}"
                return v.get("value")
            cfg["scale"] = {k: scale_value(v) for k, v in (cfg.get("scale") or {}).items()}
            if not cfg.get("identifier"):
                cfg["identifier"] = re.sub(r"\W+", "-", (a.get("title") or "").lower()).strip("-")
        cfg.pop("pool", None) if a["type"] == "ItemChoice" and not cfg.get("pool") else None
        if a["type"] == "ItemChoice" and cfg.get("pool"):
            cfg["pool"] = [ref_id(p["uuid"] if isinstance(p, dict) else p) for p in cfg["pool"]]
        out.append({k: v for k, v in {
            "id": a.get("_id"), "type": a["type"], "level": a.get("level"),
            "title": a.get("title") or a.get("name") or "", "hint": clean_html(a.get("hint") or ""),
            "classRestriction": a.get("classRestriction"), "config": cfg}.items() if v not in (None, "")})
    return out


def equipment_list(system):
    out = []
    for e in system.get("startingEquipment") or []:
        out.append({k: v for k, v in {
            "id": e.get("_id"), "type": e["type"], "group": e.get("group") or None,
            "count": e.get("count"), "key": ref_id(e.get("key")) or e.get("key"),
            "requiresProficiency": e.get("requiresProficiency") or None}.items() if v is not None})
    return out


def first_damage(system):
    for act in (system.get("activities") or {}).values():
        for part in ((act.get("damage") or {}).get("parts") or []):
            if part.get("denomination"):
                return f"{part.get('number') or 1}d{part['denomination']}", (part.get("types") or [""])[0]
    return None


def item(d, pack):
    global DEFAULT_DAMAGE
    s = d.get("system") or {}
    DEFAULT_DAMAGE = first_damage(s)
    base = {"id": d["_id"], "pack": pack, "type": d["type"], "name": d["name"],
            "identifier": s.get("identifier"), "description": clean_html((s.get("description") or {}).get("value"))}
    t = d["type"]
    if t in ("class", "subclass", "race", "background", "feat"):
        base["advancement"] = advancement(s)
    if t == "class":
        base.update(hitDie=s["hd"]["denomination"], primaryAbility=s.get("primaryAbility"),
                    spellcasting=s.get("spellcasting"), wealth=s.get("wealth"),
                    startingEquipment=equipment_list(s))
    if t == "subclass":
        base.update(classIdentifier=s.get("classIdentifier"), spellcasting=s.get("spellcasting"))
    if t == "race":
        base.update(movement=(s.get("movement") or {}).get("speeds"),
                    senses=(s.get("senses") or {}).get("ranges"), creatureType=(s.get("type") or {}).get("value"))
    if t == "background":
        base["startingEquipment"] = equipment_list(s)
    if t == "feat":
        base.update(featType=s.get("type"), prerequisites=s.get("prerequisites"),
                    requirements=s.get("requirements") or None, uses=s.get("uses", {}).get("max") or None)
    if t == "spell":
        base.update(level=s["level"], school=s["school"], properties=s.get("properties"),
                    materials=s.get("materials", {}).get("value") or None,
                    materialsCost=s.get("materials", {}).get("cost") or None,
                    materialsConsumed=s.get("materials", {}).get("consumed") or None,
                    activation=s.get("activation"), range=s.get("range"), duration=s.get("duration"),
                    target=s.get("target"))
    if pack == "equipment24":
        base.update(price=s.get("price"), weight=(s.get("weight") or {}).get("value"), rarity=s.get("rarity") or None,
                    itemType=s.get("type"), properties=s.get("properties"))
        if t == "weapon":
            dmg = s.get("damage") or {}
            base.update(damage=dmg.get("base"), versatile=dmg.get("versatile") if (dmg.get("versatile") or {}).get("denomination") else None,
                        range=s.get("range"), mastery=s.get("mastery"))
        if (s.get("armor") or {}).get("value") is not None:
            base.update(armor=s.get("armor"), strength=s.get("strength"))
        if t == "container":
            base["contents"] = None
    return {k: v for k, v in base.items() if v not in (None, "", [], {})}


docs, spell_lists, unlicensed = {}, {}, {}
for pack in PACKS:
    for p in sorted(glob.glob(os.path.join(SRC, pack, "**", "*.yml"), recursive=True)):
        if p.endswith("_folder.yml"):
            continue
        d = yaml.safe_load(open(p))
        s = d.get("system") or {}
        lic = (s.get("source") or {}).get("license") if isinstance(s.get("source"), dict) else None
        if lic != "CC-BY-4.0":
            # alguns traços/opções SRD vêm sem o campo de licença; só entram se um documento SRD os citar
            if not lic and d.get("type") != "spell":
                unlicensed[d["_id"]] = (d, pack)
            continue
        docs[d["_id"]] = item(d, pack)
        # pacotes (Explorer's Pack etc.) listam o conteúdo em itens filhos
        for child in d.get("items") or []:
            docs[d["_id"]].setdefault("contents", []).append(
                {"name": child.get("name"), "quantity": (child.get("system") or {}).get("quantity", 1),
                 "id": ref_id(((child.get("flags") or {}).get("core") or {}).get("sourceId") or
                              ((child.get("_stats") or {}).get("compendiumSource"))) })

def refs(doc):
    for a in doc.get("advancement", []):
        yield from a.get("config", {}).get("items", [])
        yield from a.get("config", {}).get("pool") or []


pending = [r for doc in docs.values() for r in refs(doc) if r in unlicensed]
while pending:
    r = pending.pop()
    if r in docs:
        continue
    docs[r] = item(*unlicensed[r])
    pending += [x for x in refs(docs[r]) if x in unlicensed]

spells = yaml.safe_load(open(os.path.join(SRC, "content24", "chapter-7", "spells.yml")))
for page in spells["pages"]:
    sys_ = page.get("system") or {}
    if page.get("type") == "spells" and sys_.get("type") == "class":
        spell_lists[sys_["identifier"]] = [i for i in (ref_id(u) for u in sys_.get("spells", [])) if i in docs]

json.dump({"meta": {"source": "System Reference Document 5.2 (SRD 5.2), Wizards of the Coast LLC",
                    "license": "CC-BY-4.0", "via": "foundryvtt/dnd5e packs/_source"},
           "docs": docs, "spellLists": spell_lists},
          open(OUT, "w"), ensure_ascii=False, indent=0, sort_keys=True)
print(len(docs), "documentos;", {k: len(v) for k, v in spell_lists.items()})
