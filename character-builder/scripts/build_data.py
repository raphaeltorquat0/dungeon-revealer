"""Gera public/srd52.json (o que o app carrega) a partir do SRD em inglês e da tradução PT-BR.

Uso: python build_data.py data/srd52.en.json i18n/srd52.pt-BR.json ../public/srd52.json
O texto traduzido substitui o inglês; o nome original fica em nameEn. Remove notas internas do Foundry.
"""
import json, re, sys

EN, PT, OUT = sys.argv[1:4]
src = json.load(open(EN))
pt = json.load(open(PT))

LOOKUP = {
    "@abilities.wis.mod": "seu modificador de Sabedoria",
    "@abilities.cha.mod": "seu modificador de Carisma",
    "@classes.druid.levels": "seu nível de Druida",
    "@item.level": "o círculo da magia",
}


def clean(html):
    if not html:
        return html
    html = re.sub(r'<section[^>]*class="secret"[^>]*>.*?</section>', "", html, flags=re.S)
    html = re.sub(r"\[\[lookup (@[\w.-]+)[^\]]*\]\](?:\{([^}]*)\})?",
                  lambda m: m.group(2) or LOOKUP.get(m.group(1), "o valor da tabela da classe"), html)
    html = re.sub(r"\[\[(@[\w.-]+)\]\]", lambda m: LOOKUP.get(m.group(1), ""), html)
    html = re.sub(r"\[\[[^\]]*\]\]\{([^}]*)\}", r"\1", html)
    html = re.sub(r"\[\[[^\]]*\]\]", "", html)
    return html.strip()


missing = []
for k, d in src["docs"].items():
    t = pt.get(k, {})
    d["nameEn"] = d["name"]
    d["name"] = t.get("name") or d["name"]
    if not t.get("name"):
        missing.append(k)
    if t.get("description"):
        d["description"] = t["description"]
    d["description"] = clean(d.get("description"))
    for field in ("materials", "requirements"):
        if t.get(field):
            d[field] = t[field]
    for a in d.get("advancement", []):
        if a["id"] in t.get("adv", {}):
            a["title"] = t["adv"][a["id"]]
        if a["id"] in t.get("adv_hint", {}):
            a["hint"] = t["adv_hint"][a["id"]]
        if a.get("hint"):
            a["hint"] = clean(a["hint"])
    d = {x: y for x, y in d.items() if y not in (None, "", [], {})}
    src["docs"][k] = d

src["meta"]["language"] = "pt-BR"
src["meta"]["attribution"] = (
    "Este conteúdo inclui material do System Reference Document 5.2 (SRD 5.2) da Wizards of the Coast LLC, "
    "disponível em https://www.dndbeyond.com/srd, licenciado sob a Creative Commons Attribution 4.0 International "
    "(https://creativecommons.org/licenses/by/4.0/legalcode). Tradução para o português não oficial.")
json.dump(src, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("documentos:", len(src["docs"]), "sem tradução de nome:", len(missing))
