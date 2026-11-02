/* Ficha de personagem e builder em JS puro. Regras: window.Regras (motor do projeto). Dados: SRD 5.2 em PT-BR. */
(function () {
  "use strict";
  const R = window.Regras;
  const SRD = JSON.parse(document.getElementById("srd-data").textContent);
  const $app = document.getElementById("app");

  // ---------------------------------------------------------------- utilidades
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[ch])
    );
  const sg = (n) => (n >= 0 ? "+" + n : "" + n);
  const m = (ft) => R.feetToMeters(Number(ft));
  const doc = (id) => SRD.docs[id];
  const icon = (name, size) => window.ico(name, size || 24);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const byName = (a, b) => doc(a).name.localeCompare(doc(b).name, "pt-BR");
  const uid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const pips = (total, used, act, extra, cls) =>
    Array.from(
      { length: total },
      (_, i) =>
        `<button class="pip ${cls || ""} ${
          i < used ? "used" : ""
        }" data-act="${act}" data-i="${i}" ${extra || ""} aria-label="${
          i < used ? "Recuperar" : "Gastar"
        } ${i + 1}"></button>`
    ).join("");

  // ---------------------------------------------------------------- armazenamento
  const stored = (k) => {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    try {
      const v = JSON.parse(raw);
      return typeof v === "string" && v ? v : null;
    } catch (e) {
      return raw;
    }
  };
  const password = () =>
    new URLSearchParams(window.location.search).get("password") ||
    stored("fichas.password") ||
    stored("dmPassword") ||
    stored("pcPassword") ||
    "";
  const api = async (path, opt) => {
    const r = await fetch(
      "api" + path,
      Object.assign({}, opt, {
        headers: {
          Authorization: "Bearer " + password(),
          "Content-Type": "application/json",
        },
      })
    );
    if (r.status === 401)
      throw Object.assign(new Error("Senha incorreta."), { code: 401 });
    if (!r.ok)
      throw new Error(
        "O servidor da mesa respondeu com erro " + r.status + "."
      );
    return (await r.json()).data;
  };
  const LOCAL = "fichas.local";
  const store = {
    mode: "loading", // loading | login | online | offline
    list: [],
    status: "",
    timer: null,
    async load() {
      if (this.mode === "offline")
        this.list = JSON.parse(localStorage.getItem(LOCAL) || "[]");
      else this.list = await api("/characters");
      this.list.sort((a, b) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || "")
      );
    },
    save(c) {
      if (state.sample) return;
      clearTimeout(this.timer);
      this.status = "Salvando…";
      paintStatus();
      this.timer = setTimeout(async () => {
        try {
          if (this.mode === "offline") {
            c.updatedAt = new Date().toISOString();
            const list = JSON.parse(localStorage.getItem(LOCAL) || "[]").filter(
              (x) => x.id !== c.id
            );
            list.unshift(clone(c));
            localStorage.setItem(LOCAL, JSON.stringify(list));
            this.status = "Salvo neste aparelho";
          } else {
            const saved = await api("/characters/" + c.id, {
              method: "PUT",
              body: JSON.stringify(c),
            });
            if (state.c && state.c.id === saved.id)
              state.c.updatedAt = saved.updatedAt;
            this.status = "Salvo";
          }
          state.dirty = false;
        } catch (e) {
          this.status = "Não salvou: " + e.message;
        }
        paintStatus();
      }, 500);
    },
    async remove(id) {
      if (this.mode === "offline")
        localStorage.setItem(
          LOCAL,
          JSON.stringify(
            JSON.parse(localStorage.getItem(LOCAL) || "[]").filter(
              (x) => x.id !== id
            )
          )
        );
      else await api("/characters/" + id, { method: "DELETE" });
    },
  };
  const paintStatus = () => {
    const el = document.getElementById("save-status");
    if (el) el.textContent = store.status;
  };

  // ---------------------------------------------------------------- estado e rotas
  const state = {
    view: "list",
    c: null,
    sample: false,
    dirty: false,
    step: 0,
    tab: "acoes",
    filter: "all",
    ui: { open: {}, q: {}, lvl: {}, manageSpells: false, levelup: null },
  };

  const route = () => {
    const [kind, id, step] = window.location.hash
      .replace(/^#\/?/, "")
      .split("/");
    state.ui.levelup = null;
    state.ui.manageSpells = false;
    if (kind === "exemplo") {
      state.view = "sheet";
      state.sample = true;
      state.c = sample();
    } else if ((kind === "ficha" || kind === "criar") && id) {
      state.sample = false;
      if (!state.c || state.c.id !== id)
        state.c = clone(
          store.list.find((x) => x.id === id) || R.emptyCharacter(id)
        );
      state.view = kind === "ficha" ? "sheet" : "builder";
      state.step = Math.max(0, Math.min(STEPS.length - 1, Number(step) || 0));
    } else {
      state.view = "list";
      state.c = null;
      state.sample = false;
    }
    render();
    window.scrollTo(0, 0);
  };
  const go = (hash) => {
    if (window.location.hash === "#" + hash) route();
    else window.location.hash = hash;
  };
  const commit = () => {
    state.dirty = true;
    if (state.c) store.save(state.c);
    render();
  };

  // ---------------------------------------------------------------- render com foco preservado
  const render = () => {
    const a = document.activeElement;
    const focusId = a && a.id;
    const sel =
      a && "selectionStart" in a ? [a.selectionStart, a.selectionEnd] : null;
    const y = window.scrollY;
    $app.innerHTML =
      store.mode === "loading"
        ? `<div class="wrap"><p class="muted">Abrindo as fichas…</p></div>`
        : store.mode === "login"
        ? loginView()
        : state.view === "sheet" && state.c
        ? state.ui.levelup
          ? levelUpView()
          : sheetView()
        : state.view === "builder" && state.c
        ? builderView()
        : listView();
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) {
        el.focus();
        if (sel && "setSelectionRange" in el)
          try {
            el.setSelectionRange(sel[0], sel[1]);
          } catch (e) {
            /* campo sem seleção de texto */
          }
      }
    }
    window.scrollTo(0, y);
  };

  // ---------------------------------------------------------------- personagem de exemplo
  const autoResolve = (c) => {
    for (let guard = 0; guard < 40; guard++) {
      const open = R.decisions(SRD, c).filter((d) => !R.isDecisionDone(d));
      if (!open.length) break;
      for (const d of open) {
        if (d.kind === "pick")
          c.choices[d.key] = d.options.slice(
            0,
            Math.min(d.count, d.options.length)
          );
        else if (d.kind === "size")
          c.choices[d.key] = [d.options.includes("med") ? "med" : d.options[0]];
        else if (d.kind === "subclass")
          c.classes[d.classIndex].subclassId = d.options[0];
        else if (d.kind === "asi") {
          const [a1, a2] = d.allowed
            .filter((ab) => ["int", "wis", "con", "dex"].includes(ab))
            .concat(d.allowed);
          c.asi[d.key] = d.background
            ? { [a1]: 2, [a2 === a1 ? d.allowed[1] : a2]: 1 }
            : { [a1]: 2 };
        }
      }
    }
    return c;
  };
  const sample = () => {
    let c = R.emptyCharacter("exemplo");
    const wizard = Object.values(SRD.docs).find(
      (d) => d.type === "class" && d.identifier === "wizard"
    );
    for (let i = 0; i < 3; i++)
      c = R.levelUp(SRD, c, wizard.id, R.averageHitDie(SRD, wizard.id));
    c.speciesId = Object.values(SRD.docs).find(
      (d) => d.type === "race" && d.identifier === "human"
    ).id;
    c.backgroundId = Object.values(SRD.docs).find(
      (d) => d.type === "background" && d.identifier === "sage"
    ).id;
    c.abilities = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };
    c.name = "Elowen Ventoalto";
    c.player = "Exemplo";
    c.details = {
      alignment: "Neutra e Boa",
      appearance:
        "Cabelos ruivos presos com uma pena de corvo, manto cinza manchado de tinta.",
      backstory:
        "Copista de um mosteiro costeiro, fugiu com um grimório que ninguém deveria ter lido.",
      notes: "Dívida de 30 PO com o taverneiro de Saltmarsh.",
    };
    autoResolve(c);
    const tree = [
      ...R.equipmentTree(doc(wizard.id)),
      ...R.equipmentTree(doc(c.backgroundId)),
    ];
    const choice = {};
    const pickA = (n) => {
      if (n.type === "OR") {
        choice[n.id] = n.children[0].id;
        pickA(n.children[0]);
      } else if (n.type === "AND") n.children.forEach(pickA);
      else if (["tool", "focus", "weapon", "armor"].includes(n.type)) {
        const opts = R.categoryItems(SRD, n);
        if (opts[0]) choice[n.id] = opts[0].id;
      }
    };
    tree.forEach(pickA);
    applyEquipment(c, choice);
    for (const l of R.spellLimits(SRD, c)) {
      c.spells.known.push(
        ...l.list
          .filter((id) => doc(id).level === 0)
          .sort(byName)
          .slice(0, l.cantrips)
      );
      c.spells.prepared.push(
        ...l.list
          .filter((id) => doc(id).level >= 1 && doc(id).level <= l.maxLevel)
          .sort(byName)
          .slice(0, l.prepared)
      );
    }
    c.state.hp = R.sheet(SRD, c).maxHp - 4;
    c.state.slotsSpent = { 1: 1 };
    return c;
  };

  // ---------------------------------------------------------------- lista e login
  const portrait = (c, small) => {
    const cls = c.classes[0] && doc(c.classes[0].classId);
    const inner = c.portrait
      ? `<img src="${esc(c.portrait)}" alt="">`
      : cls
      ? window.glyph(cls.identifier, 56)
      : esc((c.name.trim()[0] || "?").toUpperCase());
    const lvl = R.totalLevel(c);
    return `<div class="portrait">${inner}${
      lvl ? `<div class="lvl"><span class="cond">${lvl}</span></div>` : ""
    }</div>`;
  };
  const classLine = (c) => {
    const sp = c.speciesId ? doc(c.speciesId).name : "";
    const cl = c.classes
      .map(
        (e) =>
          `${doc(e.classId).name} ${e.level}${
            e.subclassId ? " (" + doc(e.subclassId).name + ")" : ""
          }`
      )
      .join(" / ");
    return [sp, cl].filter(Boolean).join(" · ") || "Em criação";
  };

  const loginView = () => `
    <div class="wrap" style="max-width:420px;padding-top:15vh">
      <div class="frame">
        <h1 class="cond" style="margin:0 0 6px;font-size:28px">Fichas da mesa</h1>
        <p class="muted">Digite a senha dos jogadores. Ela fica salva neste aparelho.</p>
        <form data-form="login">
          <label class="lbl" for="pw">Senha</label>
          <input class="field" id="pw" type="password" autocomplete="current-password">
          <p id="login-err" style="color:var(--red2)"></p>
          <button class="btn red" style="width:100%">Entrar</button>
        </form>
      </div>
    </div>`;

  const listView = () => {
    const cards = store.list
      .map((c) => {
        const max = R.totalLevel(c) ? R.sheet(SRD, c).maxHp : 0;
        const hp = Math.min(c.state.hp == null ? max : c.state.hp, max);
        const pend =
          R.decisions(SRD, c).some((d) => !R.isDecisionDone(d)) ||
          !c.name.trim();
        return `<button class="frame card" data-act="open" data-id="${esc(
          c.id
        )}">
          ${portrait(c)}
          <span style="min-width:0;flex:1">
            <span class="name">${esc(c.name || "Sem nome")}</span>
            <span class="muted">${esc(classLine(c))}${
          c.player ? " · " + esc(c.player) : ""
        }</span>
            ${
              max
                ? `<span style="display:block;margin-top:6px" class="sub">PV ${hp} / ${max}</span><span class="hpbar" style="display:block;margin:4px 0 0"><div class="${
                    hp / max <= 0.25 ? "low" : ""
                  }" style="width:${(hp / max) * 100}%"></div></span>`
                : ""
            }
            ${
              pend
                ? `<span class="sub" style="color:var(--red2)">Escolhas pendentes</span>`
                : ""
            }
          </span>
        </button>`;
      })
      .join("");
    return `<div class="wrap">
      <div class="bhead"><h1 class="cond" style="margin:0;font-size:30px">Fichas da mesa</h1>
        <span class="muted" style="margin-left:auto">${
          store.mode === "offline"
            ? "Modo local: as fichas ficam neste aparelho"
            : "Sincronizado com a mesa"
        }</span></div>
      <div class="cards">
        ${cards}
        <button class="frame card" data-act="sample">
          ${portrait(sample())}
          <span><span class="name">Ficha de exemplo</span><span class="muted">Elowen Ventoalto · Maga 3, pronta para explorar</span></span>
        </button>
        <button class="new" data-act="new"><span style="display:flex;gap:10px;align-items:center">${icon(
          "plus",
          20
        )} Criar personagem</span></button>
      </div>
      <p class="sub" style="margin-top:40px;max-width:80ch">${esc(
        SRD.meta.attribution
      )}</p>
    </div>`;
  };

  // ---------------------------------------------------------------- ficha
  const BASIC_ACTIONS = [
    ["Atacar", "Faça um ataque com uma arma ou um Ataque Desarmado."],
    [
      "Disparada",
      "Ganhe deslocamento extra igual ao seu Deslocamento neste turno.",
    ],
    [
      "Desengajar",
      "Seu deslocamento não provoca Ataques de Oportunidade neste turno.",
    ],
    [
      "Esquivar",
      "Ataques contra você têm Desvantagem e você tem Vantagem em testes de resistência de Destreza.",
    ],
    [
      "Ajudar",
      "Ajude um aliado num teste de atributo ou numa jogada de ataque.",
    ],
    ["Esconder", "Faça um teste de Destreza (Furtividade)."],
    ["Influenciar", "Tente mudar a atitude de uma criatura."],
    [
      "Magia",
      "Conjure uma magia ou use um item mágico ou característica mágica.",
    ],
    ["Preparar", "Prepare uma ação para disparar com uma Reação."],
    ["Procurar", "Faça um teste de Sabedoria para encontrar algo."],
    ["Estudar", "Faça um teste de Inteligência para lembrar ou analisar algo."],
    ["Usar", "Use um objeto que não seja uma arma."],
  ];
  const kindOf = (html) => {
    const t = (html || "").replace(/<[^>]+>/g, " ");
    if (/Ação Bônus/i.test(t)) return "bonus";
    if (/\bReação\b/.test(t)) return "reaction";
    if (
      /(como uma ação|uma ação de Magia|ação de Ataque|usar uma ação|como ação)/i.test(
        t
      )
    )
      return "action";
    return null;
  };

  const sheetView = () => {
    const c = state.c;
    const s = R.sheet(SRD, c);
    const hp = Math.min(c.state.hp == null ? s.maxHp : c.state.hp, s.maxHp);
    const pending = R.decisions(SRD, c).filter((d) => !R.isDecisionDone(d));
    const t = s.traits;
    const ab = R.ABILITIES.map(
      (k) => `<div class="frame ab"><div class="k">${window.glyph(k, 16)}${
        R.ABILITY_SHORT[k]
      }</div><div class="n">${R.ABILITY_LABEL[k]}</div>
      <div class="m">${sg(s.modifiers[k])}</div><div class="s">${
        s.scores[k]
      }</div></div>`
    ).join("");

    const saves = R.ABILITIES.map(
      (k) =>
        `<div class="row"><span class="prof ${
          s.saves[k].proficient ? "p" : ""
        }"></span><span class="nm">${
          R.ABILITY_LABEL[k]
        }</span><span class="val ${s.saves[k].proficient ? "hi" : ""}">${sg(
          s.saves[k].bonus
        )}</span></div>`
    ).join("");
    const skills = Object.entries(R.SKILLS)
      .sort((a, b) => a[1].label.localeCompare(b[1].label, "pt-BR"))
      .map(([k, info]) => {
        const sk = s.skills[k];
        return `<div class="row"><span class="prof ${
          sk.expertise ? "e" : sk.proficient ? "p" : ""
        }" title="${
          sk.expertise ? "Especialização" : sk.proficient ? "Proficiente" : ""
        }"></span>
          <span class="ab3">${
            R.ABILITY_SHORT[info.ability]
          }</span><span class="nm">${info.label}</span><span class="val ${
          sk.proficient ? "hi" : ""
        }">${sg(sk.bonus)}</span></div>`;
      })
      .join("");
    const group = (prefix) =>
      [...t]
        .filter((x) => x.startsWith(prefix))
        .map((x) => R.traitLabel(SRD, x));
    const profs = [
      ["Armaduras", group("armor:")],
      ["Armas", group("weapon:")],
      ["Ferramentas", group("tool:")],
      ["Idiomas", group("languages:")],
    ]
      .map(
        ([k, v]) =>
          `<div style="margin-bottom:8px"><div class="sub cond">${k}</div>${
            v.length ? esc(v.join(", ")) : '<span class="muted">Nenhuma</span>'
          }</div>`
      )
      .join("");

    const resist = group("dr:");
    const conds = Object.entries(R.CONDITIONS)
      .map(
        ([k, label]) =>
          `<button class="chip ${
            c.state.conditions.includes(k) ? "on" : ""
          }" data-act="cond" data-k="${k}">${label}</button>`
      )
      .join("");

    const left = `
      <div class="frame"><div class="title">${icon(
        "shield",
        15
      )}Testes de Resistência</div>${saves}</div>
      <div class="frame"><div class="title">${icon(
        "d20",
        15
      )}Perícias <span class="legend"><span><span class="prof p"></span>proficiente</span><span><span class="prof e"></span>especialização</span></span></div>${skills}</div>
      <div class="frame"><div class="title">${icon("eye", 15)}Sentidos</div>
        <div class="row"><span class="val">${
          s.passivePerception
        }</span><span class="nm">Percepção passiva</span></div>
        <div class="row"><span class="val">${
          10 + s.skills.ins.bonus
        }</span><span class="nm">Intuição passiva</span></div>
        <div class="row"><span class="val">${
          10 + s.skills.inv.bonus
        }</span><span class="nm">Investigação passiva</span></div>
        ${
          s.darkvision
            ? `<div class="row"><span class="val">${m(
                s.darkvision
              )}</span><span class="nm">Visão no escuro</span></div>`
            : ""
        }
      </div>
      <div class="frame"><div class="title">${icon(
        "list",
        15
      )}Proficiências e Idiomas</div>${profs}</div>`;

    const center = `
      <div class="stats">
        <div class="frame stat"><div class="shield"><svg viewBox="0 0 84 96" aria-hidden="true"><defs><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26262f"/><stop offset="1" stop-color="#0b0b0f"/></linearGradient></defs><path d="M42 2 80 14v30c0 26-17 41-38 50C21 85 4 70 4 44V14z" fill="url(#sh)" stroke="#c23a2e" stroke-width="2"/><path d="M42 10 72 20v24c0 21-13 33-30 41C25 77 12 65 12 44V20z" fill="none" stroke="#3a3a44"/></svg><span>${
          s.ac
        }</span></div><div class="l">Classe de Armadura</div></div>
        <div class="frame stat"><div class="v" style="margin-top:14px">${sg(
          s.initiative
        )}</div><div class="l">${icon("bonus", 13)}Iniciativa</div>
          <div class="sub" style="margin-top:6px;display:flex;gap:5px;justify-content:center;align-items:center">${icon(
            "boot",
            14
          )}${m(s.speed)} de deslocamento</div></div>
        <div class="frame stat"><div class="v">${sg(
          s.proficiencyBonus
        )}</div><div class="l">${icon("plus", 13)}Proficiência</div></div>
        <button class="frame stat insp ${
          c.state.inspiration ? "on" : ""
        }" data-act="insp" style="color:inherit">
          <div class="v">${icon(
            "star",
            30
          )}</div><div class="l">Inspiração Heroica</div></button>
      </div>
      <div class="frame">
        <div class="title">${icon("heart", 15)}Pontos de Vida</div>
        <div class="hp-top">
          <div><div class="big" style="${
            hp / s.maxHp <= 0.25 ? "color:var(--red2)" : ""
          }">${hp}</div><div class="l">Atuais</div></div>
          <div class="sep">/</div>
          <div><div class="big">${
            s.maxHp
          }</div><div class="l">Máximo</div></div>
          <div><div class="big" style="color:${
            c.state.temp ? "#7fc4e8" : "var(--muted)"
          }">${c.state.temp || "–"}</div><div class="l">Temporários</div></div>
        </div>
        <div class="hpbar"><div class="${
          hp / s.maxHp <= 0.25 ? "low" : ""
        }" style="width:${Math.max(0, (hp / s.maxHp) * 100)}%"></div></div>
        <div class="hp-ctl">
          <button class="btn heal" data-act="hp" data-mode="heal">${icon(
            "plus",
            14
          )}Curar</button>
          <button class="btn red" data-act="hp" data-mode="dmg">${icon(
            "attack",
            14
          )}Dano</button>
          <input class="field" id="hp-amt" type="number" inputmode="numeric" min="0" placeholder="0" aria-label="Quantidade">
          <button class="btn" data-act="hp" data-mode="temp">Temp.</button>
        </div>
      </div>
      <div class="frame"><div class="title">${icon(
        "d20",
        15
      )}Dados de Vida</div>
        ${s.hitDice
          .map(
            (h) =>
              `<div class="row"><span class="nm">${esc(doc(h.classId).name)} (${
                h.die
              })</span>${pips(
                h.count,
                c.state.hitDiceSpent[h.classId] || 0,
                "hd",
                `data-cls="${h.classId}"`
              )}</div>`
          )
          .join("")}
      </div>
      <div class="frame"><div class="title">${icon(
        "skull",
        15
      )}Testes contra a Morte</div>
        <div class="row"><span class="nm">Sucessos</span>${pips(
          3,
          c.state.deathSaves.success,
          "death",
          'data-k="success"',
          "ok"
        )}</div>
        <div class="row"><span class="nm">Falhas</span>${pips(
          3,
          c.state.deathSaves.failure,
          "death",
          'data-k="failure"',
          "fail"
        )}</div>
      </div>
      <div class="frame"><div class="title">${icon(
        "shield",
        15
      )}Defesas e Condições</div>
        <div style="margin-bottom:8px"><div class="sub cond">Resistências</div>${
          resist.length
            ? esc(
                resist
                  .map((r) => r.replace("Resistência a dano ", ""))
                  .join(", ")
              )
            : '<span class="muted">Nenhuma</span>'
        }</div>
        <div class="sub cond" style="margin-bottom:4px">Condições</div>${conds}
        <div class="row" style="margin-top:4px"><span class="nm">Exaustão</span>${pips(
          6,
          c.state.exhaustion,
          "exh",
          "",
          "fail"
        )}</div>
      </div>`;

    const TABS = [
      ["acoes", "Ações", "attack"],
      ["magias", "Magias", "spell"],
      ["equip", "Equipamento", "bag"],
      ["tracos", "Características", "book"],
      ["desc", "Descrição", "user"],
      ["notas", "Notas", "scroll"],
      ["uso", "Uso Limitado", "limited"],
    ];
    const tabs = `<div class="tabs" role="tablist">${TABS.map(
      ([k, l, i]) =>
        `<button role="tab" aria-selected="${state.tab === k}" class="${
          state.tab === k ? "on" : ""
        }" data-act="tab" data-t="${k}">${icon(i, 15)}${l}</button>`
    ).join("")}</div>`;
    const body = {
      acoes: actionsTab,
      magias: spellsTab,
      equip: equipTab,
      tracos: featuresTab,
      desc: descTab,
      notas: notesTab,
      uso: limitedTab,
    }[state.tab](c, s);

    return `<div class="wrap">
      ${
        state.sample
          ? `<div class="banner">Ficha de exemplo: as mudanças não são salvas. <button class="btn small" data-act="adopt">Usar como base de um personagem novo</button></div>`
          : ""
      }
      <div class="frame head">
        ${portrait(c)}
        <div class="who"><h1>${esc(c.name || "Sem nome")}</h1>
          <div class="line">${esc(classLine(c))}</div>
          <div class="sub">${
            c.player ? "Jogador: " + esc(c.player) : ""
          } <span id="save-status">${
      state.sample ? "" : esc(store.status)
    }</span></div></div>
        <div class="head-actions">
          <button class="btn" data-act="rest-short" title="Descanso Curto">${icon(
            "moon",
            15
          )}<span class="t">Descanso Curto</span></button>
          <button class="btn" data-act="rest-long" title="Descanso Longo">${icon(
            "fire",
            15
          )}<span class="t">Descanso Longo</span></button>
          <button class="btn" data-act="manage" title="Gerenciar no builder">${icon(
            "gear",
            15
          )}<span class="t">Gerenciar</span></button>
          <button class="btn red" data-act="levelup">${icon(
            "up",
            15
          )}Subir de Nível</button>
          <button class="btn ghost" data-act="home" aria-label="Voltar às fichas">${icon(
            "back",
            15
          )}<span class="t">Fichas</span></button>
        </div>
      </div>
      ${
        pending.length
          ? `<div class="banner" style="margin-top:12px">${
              pending.length === 1
                ? "Falta 1 escolha"
                : "Faltam " + pending.length + " escolhas"
            } nesta ficha. <button class="btn small" data-act="levelup-choices">Resolver</button></div>`
          : ""
      }
      <div class="abilities">${ab}</div>
      <div class="zones">
        <div class="z1">${left}</div>
        <div class="z2">${center}</div>
        <div class="z3 frame">${tabs}${body}</div>
      </div>
    </div>`;
  };

  const spellIds = (c) =>
    [
      ...new Set([
        ...c.spells.known,
        ...c.spells.prepared,
        ...R.grantedSpells(SRD, c).map((g) => g.id),
      ]),
    ].filter((id) => doc(id));

  const actionsTab = (c, s) => {
    const sc = s.spellcasting[0];
    const rows = [];
    for (const a of s.attacks)
      rows.push({
        f: "attack",
        name: a.name,
        sub: "Ataque com arma",
        range: a.range
          ? a.range
              .split("/")
              .map((v) => m(v))
              .join(" / ")
          : "1,5 m",
        hit: sg(a.toHit),
        dmg: `${a.damage} ${(
          R.DAMAGE_LABEL[a.damageType] || ""
        ).toLowerCase()}`,
        extra: a.mastery
          ? "Maestria: " + (R.MASTERY_LABEL[a.mastery] || a.mastery)
          : "",
      });
    for (const id of spellIds(c)) {
      const d = doc(id);
      const act = d.activation && d.activation.type;
      const txt = (d.description || "").replace(/<[^>]+>/g, " ");
      const atk = /jogada de ataque/i.test(txt);
      const save = txt.match(
        /teste de resistência de (Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/i
      );
      const f =
        act === "bonus"
          ? "bonus"
          : act === "reaction"
          ? "reaction"
          : atk || save
          ? "attack"
          : act === "action"
          ? "action"
          : "other";
      const range =
        d.range && d.range.value
          ? m(d.range.value)
          : d.range && d.range.units === "self"
          ? "Pessoal"
          : d.range && d.range.units === "touch"
          ? "Toque"
          : "–";
      rows.push({
        f,
        name: d.name,
        sub:
          (d.level ? d.level + "º círculo" : "Truque") +
          (atk ? ", ataque de magia" : save ? ", resistência" : ""),
        range,
        hit: sc ? (atk ? sg(sc.attack) : save ? "CD " + sc.dc : "–") : "–",
        dmg: "",
        docId: id,
      });
    }
    for (const { doc: d, source } of s.features) {
      const k = kindOf(d.description);
      if (k)
        rows.push({
          f: k,
          name: d.name,
          sub: source.name,
          range: "",
          hit: "",
          dmg: "",
          docId: d.id,
          limited: Boolean(d.uses),
        });
    }
    for (const [n, desc] of BASIC_ACTIONS)
      rows.push({ f: "action", name: n, sub: desc, basic: true });
    const F = [
      ["all", "Todos"],
      ["attack", "Ataque"],
      ["action", "Ação"],
      ["bonus", "Ação Bônus"],
      ["reaction", "Reação"],
      ["other", "Outros"],
      ["limited", "Uso Limitado"],
    ];
    const FI = {
      all: "list",
      attack: "attack",
      action: "action",
      bonus: "bonus",
      reaction: "reaction",
      other: "other",
      limited: "limited",
    };
    const filters = `<div class="filters">${F.map(
      ([k, l]) =>
        `<button class="${
          state.filter === k ? "on" : ""
        }" data-act="filter" data-f="${k}">${icon(FI[k], 13)}${l}</button>`
    ).join("")}</div>`;
    if (state.filter === "limited") return filters + limitedTab(c, s);
    const show = rows.filter(
      (r) => state.filter === "all" || r.f === state.filter
    );
    const groups = [
      ["attack", "Ataques"],
      ["action", "Ações"],
      ["bonus", "Ações Bônus"],
      ["reaction", "Reações"],
      ["other", "Outros"],
    ];
    return (
      filters +
      groups
        .map(([k, title]) => {
          const g = show.filter((r) => r.f === k);
          if (!g.length) return "";
          if (k === "attack")
            return `<div class="grouph">${title}</div><table class="list"><thead><tr><th>Nome</th><th>Alcance</th><th>Acerto / CD</th><th>Dano</th></tr></thead><tbody>${g
              .map(
                (r) =>
                  `<tr><td><div class="nm-cell">${icon(
                    r.docId ? "spell" : "attack",
                    16
                  )}<div>${esc(r.name)}<div class="sub">${esc(r.sub)}${
                    r.extra ? " · " + esc(r.extra) : ""
                  }</div></div></div></td><td class="n">${esc(
                    r.range
                  )}</td><td class="n hit"><span>${esc(
                    r.hit
                  )}</span></td><td class="n">${esc(r.dmg) || "–"}</td></tr>`
              )
              .join("")}</tbody></table>`;
          return `<div class="grouph">${title}</div>${g
            .map((r) =>
              r.docId
                ? `<details class="item"><summary><span>${esc(
                    r.name
                  )}</span><span class="sub">${esc(
                    r.sub
                  )}</span></summary><div class="rules">${
                    doc(r.docId).description || ""
                  }</div></details>`
                : `<div class="row"><span class="nm">${esc(
                    r.name
                  )} <span class="sub">${esc(r.sub)}</span></span></div>`
            )
            .join("")}`;
        })
        .join("")
    );
  };

  const spellsTab = (c, s) => {
    if (state.ui.manageSpells)
      return `<button class="btn" data-act="manage-spells">Concluir</button>${spellPicker(
        c
      )}`;
    const head = s.spellcasting
      .map(
        (
          l
        ) => `<div class="stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:10px">
        <div class="frame stat"><div class="v">${
          R.ABILITY_SHORT[l.ability]
        }</div><div class="l">Atributo</div></div>
        <div class="frame stat"><div class="v">${sg(
          l.attack
        )}</div><div class="l">Ataque de magia</div></div>
        <div class="frame stat"><div class="v">${
          l.dc
        }</div><div class="l">CD de resistência</div></div></div>`
      )
      .join("");
    const slots =
      s.slots.slots
        .map(
          (n, i) =>
            `<div class="row"><span class="nm">${i + 1}º círculo</span>${pips(
              n,
              c.state.slotsSpent[i + 1] || 0,
              "slot",
              `data-l="${i + 1}"`
            )}</div>`
        )
        .join("") +
      (s.slots.pact
        ? `<div class="row"><span class="nm">Pacto (${
            s.slots.pact.level
          }º círculo)</span>${pips(
            s.slots.pact.count,
            c.state.pactSpent,
            "pact"
          )}</div>`
        : "");
    const ids = spellIds(c);
    const levels = [...new Set(ids.map((id) => doc(id).level || 0))].sort(
      (a, b) => a - b
    );
    const granted = new Set(R.grantedSpells(SRD, c).map((g) => g.id));
    const list = levels
      .map(
        (lv) =>
          `<div class="grouph">${lv ? lv + "º círculo" : "Truques"}</div>${ids
            .filter((id) => (doc(id).level || 0) === lv)
            .sort(byName)
            .map((id) => {
              const d = doc(id);
              const tags = [
                R.SCHOOL_LABEL[d.school] || "",
                (d.properties || []).includes("concentration")
                  ? "Concentração"
                  : "",
                (d.properties || []).includes("ritual") ? "Ritual" : "",
                granted.has(id) ? "Sempre preparada" : "",
              ].filter(Boolean);
              return `<details class="item"><summary><span>${esc(
                d.name
              )}</span><span class="sub">${tags.join(
                " · "
              )}</span></summary><div class="rules">${
                d.description || ""
              }</div></details>`;
            })
            .join("")}`
      )
      .join("");
    return `${head}${
      slots
        ? `<div class="title">${icon(
            "spell",
            15
          )}Espaços de Magia</div>${slots}`
        : ""
    }
      ${list || '<p class="muted">Nenhuma magia.</p>'}
      ${
        s.spellcasting.length
          ? `<p><button class="btn" data-act="manage-spells">Gerenciar magias</button></p>`
          : ""
      }`;
  };

  const equipTab = (c) => {
    const q = (state.ui.q.item || "").trim().toLowerCase();
    const results =
      q.length >= 2
        ? Object.values(SRD.docs)
            .filter(
              (d) =>
                d.pack === "equipment24" && d.name.toLowerCase().includes(q)
            )
            .slice(0, 12)
        : [];
    const weight = c.inventory.reduce(
      (w, i) =>
        w +
        (i.itemId && doc(i.itemId)
          ? (doc(i.itemId).weight || 0) * i.quantity
          : 0),
      0
    );
    return `<div class="title">${icon("bag", 15)}Moedas</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">${[
        ["pp", "PL"],
        ["gp", "PO"],
        ["ep", "PE"],
        ["sp", "PP"],
        ["cp", "PC"],
      ]
        .map(
          ([k, l]) =>
            `<label class="sub cond" style="text-align:center">${l}<input class="field" id="cur-${k}" data-bind="currency.${k}" data-num type="number" inputmode="numeric" value="${c.currency[k]}" style="text-align:center"></label>`
        )
        .join("")}</div>
      <div class="title" style="margin-top:14px">Inventário <span class="right sub">${(
        weight * 0.5
      ).toLocaleString("pt-BR")} kg</span></div>
      <table class="list"><thead><tr><th></th><th>Item</th><th>Qtd.</th><th></th></tr></thead><tbody>
      ${c.inventory
        .map((it) => {
          const d = it.itemId ? doc(it.itemId) : null;
          const eq = d && (d.type === "weapon" || d.armor);
          return `<tr><td class="n">${
            eq
              ? `<button class="chip ${
                  it.equipped ? "on" : ""
                }" style="margin:0" data-act="equip" data-uid="${esc(
                  it.uid
                )}">${it.equipped ? "Equipado" : "Equipar"}</button>`
              : ""
          }</td>
            <td>${
              d
                ? `<details class="item" style="border:0"><summary style="padding:0">${esc(
                    d.name
                  )}</summary><div class="rules">${
                    d.description || ""
                  }</div></details>`
                : esc(it.name)
            }</td>
            <td class="n">${it.quantity}</td>
            <td class="n"><button class="btn small" data-act="qty" data-uid="${esc(
              it.uid
            )}" data-d="-1" aria-label="Remover um">−</button> <button class="btn small" data-act="qty" data-uid="${esc(
            it.uid
          )}" data-d="1" aria-label="Adicionar um">+</button></td></tr>`;
        })
        .join("")}</tbody></table>
      <label class="lbl" for="item-q">Adicionar item</label>
      <input class="field" id="item-q" data-bind-ui="q.item" placeholder="Busque pelo nome, ex.: corda" value="${esc(
        state.ui.q.item || ""
      )}">
      <div style="margin-top:8px">${results
        .map(
          (d) =>
            `<button class="chip" data-act="additem" data-id="${d.id}">${esc(
              d.name
            )}</button>`
        )
        .join("")}</div>`;
  };

  const featuresTab = (c, s) => {
    const groups = {};
    for (const f of s.features) {
      const src = f.source;
      const k =
        src.type === "race" || src.featType?.value === "race"
          ? "Espécie"
          : src.type === "background"
          ? "Antecedente"
          : src.type === "feat" && src.featType?.value === "feat"
          ? "Talentos"
          : "Classe";
      (groups[k] = groups[k] || []).push(f);
    }
    return ["Classe", "Espécie", "Antecedente", "Talentos"]
      .filter((k) => groups[k])
      .map(
        (k) =>
          `<div class="grouph">${k}</div>${groups[k]
            .map(
              ({ doc: d, source }) =>
                `<details class="item"><summary><span>${esc(
                  d.name
                )}</span><span class="sub">${esc(
                  source.name
                )}</span></summary><div class="rules">${
                  d.description || ""
                }</div></details>`
            )
            .join("")}`
      )
      .join("");
  };

  const descTab = (c) => {
    const bg = c.backgroundId && doc(c.backgroundId);
    const sp = c.speciesId && doc(c.speciesId);
    return `<div class="stats" style="grid-template-columns:1fr 1fr">
        <div class="frame"><div class="title">Antecedente</div><b style="font-size:17px;font-weight:800">${
          bg ? esc(bg.name) : "–"
        }</b><div class="sub">${
      bg ? esc(R.BACKGROUND_LORE[bg.identifier] || "") : ""
    }</div></div>
        <div class="frame"><div class="title">Espécie</div><b style="font-size:17px;font-weight:800">${
          sp ? esc(sp.name) : "–"
        }</b><div class="sub">${
      sp ? esc(R.SPECIES_LORE[sp.identifier] || "") : ""
    }</div></div></div>
      <label class="lbl" for="d-al">Alinhamento</label><input class="field" id="d-al" data-bind="details.alignment" value="${esc(
        c.details.alignment || ""
      )}">
      <label class="lbl" for="d-ap">Aparência</label><textarea class="field" id="d-ap" data-bind="details.appearance">${esc(
        c.details.appearance || ""
      )}</textarea>
      <label class="lbl" for="d-hi">História</label><textarea class="field" id="d-hi" data-bind="details.backstory">${esc(
        c.details.backstory || ""
      )}</textarea>`;
  };

  const notesTab = (
    c
  ) => `<label class="lbl" for="d-no">Anotações da campanha</label>
    <textarea class="field" id="d-no" data-bind="details.notes" style="min-height:280px">${esc(
      c.details.notes || ""
    )}</textarea>
    <p style="margin-top:20px"><button class="btn ghost" data-act="delete" style="border-color:var(--red)">Excluir ficha</button></p>`;

  const resources = (s) =>
    s.scales.filter(
      (x) =>
        !/\.(max-prepared|cantrips-known|invocations-known)$/.test(x.identifier)
    );
  const limitedTab = (c, s) => {
    const rs = resources(s);
    const rows = rs
      .map((r) => {
        const track =
          typeof r.value === "number" &&
          (r.type === "usage" ||
            /fúria|rage|pontos|points|foco|focus|usos|uses|canalizar|channel/i.test(
              r.title + r.identifier
            ));
        return `<div class="row"><span class="nm">${esc(
          r.title
        )} <span class="sub">${esc(r.source.name)}</span></span>${
          track
            ? pips(
                Number(r.value),
                c.state.uses[r.identifier] || 0,
                "use",
                `data-k="${esc(r.identifier)}"`
              )
            : `<span class="val">${
                r.type === "distance" ? "+" + m(r.value) : esc(r.value)
              }</span>`
        }</div>`;
      })
      .join("");
    return `<div class="title">Recursos e usos</div>${
      rows || '<p class="muted">Nenhum recurso com uso limitado.</p>'
    }
      <p class="sub">Descanso Longo recupera tudo; Descanso Curto recupera espaços de pacto.</p>`;
  };

  // ---------------------------------------------------------------- decisões (builder e subir de nível)
  const decisionHTML = (d) => {
    const done = R.isDecisionDone(d);
    const head = `<h3><span class="st ${done ? "ok" : ""}"></span>${esc(
      d.title
    )} <span class="sub" style="text-transform:none;letter-spacing:0">${esc(
      d.source.name
    )}</span></h3>${
      d.hint ? `<div class="rules" style="padding:0">${d.hint}</div>` : ""
    }`;
    if (d.kind === "pick") {
      const limit = Math.min(d.count, d.options.length);
      const count = `<div class="sub" style="margin:2px 0 8px">${
        limit === 1
          ? "Escolha 1."
          : `Escolha ${limit}: ${d.chosen.length} de ${limit}.`
      }</div>`;
      if (d.optionKind === "trait")
        return `<div class="frame decision">${head}${count}${d.options
          .map((o) => [o, R.traitLabel(SRD, o)])
          .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
          .map(
            ([o, l]) =>
              `<button class="chip ${
                d.chosen.includes(o) ? "on" : ""
              }" data-act="pick" data-key="${esc(d.key)}" data-val="${esc(
                o
              )}">${esc(l)}</button>`
          )
          .join("")}</div>`;
      return `<div class="frame decision">${head}${count}${docOptions(
        d.key,
        d.options,
        d.chosen,
        "pick"
      )}</div>`;
    }
    if (d.kind === "asi") {
      const cur = state.c.asi[d.key] || {};
      const scores = R.abilityScores(SRD, state.c);
      const feat = (state.c.choices[d.key] || [])[0];
      return `<div class="frame decision">${head}<div class="sub" style="margin:2px 0 8px">${
        d.background
          ? "Some +2 em um atributo e +1 em outro, ou +1 em três. Nenhum passa de 20."
          : "Some +2 em um atributo ou +1 em dois, sem passar de 20, ou escolha um talento."
      }</div>
        <div class="asi">${d.allowed
          .map(
            (k) => `<div class="${cur[k] ? "on" : ""}"><span><b>${
              R.ABILITY_SHORT[k]
            }</b> <span class="muted">${scores[k]}</span></span>
            <span><button class="btn small" data-act="asi" data-key="${esc(
              d.key
            )}" data-ab="${k}" data-d="-1" aria-label="Tirar 1">−</button>
            <b style="display:inline-block;min-width:24px;text-align:center;color:var(--red2)">${
              cur[k] ? "+" + cur[k] : ""
            }</b>
            <button class="btn small" data-act="asi" data-key="${esc(
              d.key
            )}" data-ab="${k}" data-d="1" aria-label="Somar 1">+</button></span></div>`
          )
          .join("")}</div>
        ${
          d.featOptions.length
            ? `<div class="sub" style="margin:10px 0 6px">Ou troque por um talento:</div>${docOptions(
                d.key,
                d.featOptions,
                feat ? [feat] : [],
                "asifeat"
              )}`
            : ""
        }</div>`;
    }
    if (d.kind === "subclass") {
      const e = state.c.classes[d.classIndex];
      return `<div class="frame decision">${head}${docOptions(
        d.key,
        d.options,
        e.subclassId ? [e.subclassId] : [],
        "subclass",
        `data-idx="${d.classIndex}"`
      )}</div>`;
    }
    const chosen = (state.c.choices[d.key] || [])[0];
    return `<div class="frame decision">${head}${d.options
      .map(
        (o) =>
          `<button class="chip ${
            chosen === o ? "on" : ""
          }" data-act="size" data-key="${esc(d.key)}" data-val="${o}">${
            R.SIZE_LABEL[o] || o
          }</button>`
      )
      .join("")}</div>`;
  };

  const docOptions = (key, ids, chosen, act, extra) => {
    const q = (state.ui.q[key] || "").trim().toLowerCase();
    const spells =
      ids.length && ids.every((id) => doc(id) && doc(id).type === "spell");
    const lv = state.ui.lvl[key];
    const levels = spells
      ? [...new Set(ids.map((id) => doc(id).level || 0))].sort((a, b) => a - b)
      : [];
    const shown = ids
      .filter((id) => doc(id))
      .filter((id) => lv == null || (doc(id).level || 0) === lv)
      .filter(
        (id) =>
          !q ||
          (doc(id).name + " " + (doc(id).nameEn || ""))
            .toLowerCase()
            .includes(q)
      )
      .sort(
        (a, b) => (doc(a).level || 0) - (doc(b).level || 0) || byName(a, b)
      );
    const tools =
      ids.length > 10
        ? `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">
          <input class="field" id="q-${esc(key)}" data-bind-ui="q.${esc(
            key
          )}" placeholder="Buscar pelo nome" value="${esc(
            state.ui.q[key] || ""
          )}" style="flex:1 1 200px;width:auto">
          ${
            levels.length > 1
              ? `<span class="filters" style="margin:0">${[
                  ["", "Todos"],
                  ...levels.map((l) => [String(l), l ? l + "º" : "Truques"]),
                ]
                  .map(
                    ([v, l]) =>
                      `<button class="${
                        String(lv == null ? "" : lv) === v ? "on" : ""
                      }" data-act="lvlfilter" data-key="${esc(
                        key
                      )}" data-v="${v}">${l}</button>`
                  )
                  .join("")}</span>`
              : ""
          }
        </div>${
          chosen.length
            ? `<div class="sub" style="margin-bottom:6px">Escolhidas: <span style="color:var(--red2)">${esc(
                chosen.map((id) => doc(id) && doc(id).name).join(", ")
              )}</span></div>`
            : ""
        }`
        : "";
    return (
      tools +
      `<div class="docopts">${shown
        .map((id) => {
          const d = doc(id);
          const sub =
            d.type === "spell"
              ? `${d.level ? d.level + "º círculo" : "Truque"}, ${
                  R.SCHOOL_LABEL[d.school] || ""
                }`
              : "";
          const open = state.ui.open[key + "|" + id];
          return `<div class="docopt ${chosen.includes(id) ? "on" : ""}">
            <button data-act="${act}" data-key="${esc(key)}" data-val="${id}" ${
            extra || ""
          } aria-pressed="${chosen.includes(id)}">${esc(d.name)}${
            sub ? `<span class="sub" style="display:block">${sub}</span>` : ""
          }</button>
            ${
              d.description
                ? `<button class="more" data-act="desc" data-k="${esc(
                    key + "|" + id
                  )}" aria-label="Descrição">${open ? "−" : "+"}</button>`
                : ""
            }
          </div>${
            open
              ? `<div class="docdesc frame rules">${d.description}</div>`
              : ""
          }`;
        })
        .join("")}</div>${
        shown.length ? "" : '<p class="muted">Nada com esse nome.</p>'
      }`
    );
  };

  const findDecision = (key) =>
    R.decisions(SRD, state.c).find((d) => d.key === key);

  // ---------------------------------------------------------------- builder
  const rootDone = (c, root) =>
    R.decisions(SRD, c)
      .filter((d) => d.root === root)
      .every(R.isDecisionDone);
  const abilitiesValid = (c) => {
    const v = R.ABILITIES.map((k) => c.abilities[k]);
    if (c.abilityMethod === "standard")
      return [...v].sort((a, b) => b - a).join() === R.STANDARD_ARRAY.join();
    if (c.abilityMethod === "pointbuy")
      return (
        v.every((x) => x >= 8 && x <= 15) && R.pointBuySpent(c.abilities) <= 27
      );
    return v.every((x) => x >= 3 && x <= 20);
  };
  const spellsDone = (c) =>
    R.spellLimits(SRD, c).every((l) => {
      const cantrips = c.spells.known.filter(
        (id) => l.list.includes(id) && doc(id).level === 0
      ).length;
      const prep = c.spells.prepared.filter((id) => l.list.includes(id)).length;
      return cantrips >= l.cantrips && prep >= l.prepared;
    });
  const eqTrees = (c) => ({
    cls: R.equipmentTree(c.classes[0] && doc(c.classes[0].classId)),
    bg: R.equipmentTree(c.backgroundId && doc(c.backgroundId)),
  });
  const eqPending = (c) => {
    const t = eqTrees(c);
    const ch = c.equipmentChoice || {};
    return (
      R.pendingEquipment(SRD, t.cls, ch).length +
      R.pendingEquipment(SRD, t.bg, ch).length
    );
  };
  function applyEquipment(c, choice) {
    const t = eqTrees(c);
    const a = R.resolveEquipment(SRD, t.cls, choice);
    const b = R.resolveEquipment(SRD, t.bg, choice);
    const cur = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    for (const x of [a.currency, b.currency])
      for (const k in x) cur[k] += x[k] || 0;
    c.equipmentChoice = choice;
    c.inventory = [...a.items, ...b.items];
    c.currency = cur;
  }

  const STEPS = [
    { id: "inicio", title: "Início", done: (c) => c.name.trim().length > 0 },
    {
      id: "especie",
      title: "Espécie",
      done: (c) => Boolean(c.speciesId) && rootDone(c, "species"),
    },
    {
      id: "classe",
      title: "Classe",
      done: (c) =>
        c.classes.length > 0 && rootDone(c, "class") && spellsDone(c),
    },
    {
      id: "antecedente",
      title: "Antecedente",
      done: (c) => Boolean(c.backgroundId) && rootDone(c, "background"),
    },
    {
      id: "atributos",
      title: "Atributos",
      done: (c) => c.classes.length > 0 && abilitiesValid(c),
    },
    {
      id: "equipamento",
      title: "Equipamento",
      done: (c) =>
        c.classes.length > 0 && Boolean(c.backgroundId) && eqPending(c) === 0,
    },
    {
      id: "revisao",
      title: "Revisão",
      done: (c) => STEPS.slice(0, -1).every((s) => s.done(c)),
    },
  ];

  // kv: [[rótulo, valor], ...] mostrados como uma pequena tabela no pé do cartão
  const optCard = (d, on, act, sub, kv) => `<button class="opt ${
    on ? "on" : ""
  }" data-act="${act}" data-id="${d.id}" aria-pressed="${on}">
      ${window.emblem(d.identifier, 54, on)}<span class="check">${icon(
    "check",
    12
  )}</span>
      <span style="min-width:0"><b>${esc(d.name)}</b>${
    sub ? `<span class="tagline">${esc(sub)}</span>` : ""
  }</span>${
    kv && kv.length
      ? `<span class="kv">${kv
          .filter((x) => x && x[1])
          .map(
            ([k, v]) =>
              `<span><i>${esc(k)}</i><em title="${esc(v)}">${esc(
                v
              )}</em></span>`
          )
          .join("")}</span>`
      : ""
  }</button>`;

  const detailPanel = (d) => {
    if (!d) return "";
    const html = d.description || "";
    const table = (html.match(/<table[\s\S]*?<\/table>/) || [])[0];
    const feats = (d.advancement || [])
      .filter((a) => a.type === "ItemGrant" && (a.level || 0) <= 1)
      .flatMap((a) => a.config.items || [])
      .map(doc)
      .filter(Boolean);
    return `<div class="frame"><div style="display:flex;gap:12px;align-items:center">${window.emblem(
      d.identifier,
      64,
      true
    )}
        <div><div style="font-size:22px;font-weight:800;letter-spacing:-.01em">${esc(
          d.name
        )}</div><div class="sub">${esc(
      (R.CLASS_LORE[d.identifier] || {}).tagline ||
        R.SPECIES_LORE[d.identifier] ||
        R.BACKGROUND_LORE[d.identifier] ||
        ""
    )}</div></div></div>
      ${table ? `<div class="rules">${table}</div>` : ""}
      ${
        feats.length
          ? `<div class="title" style="margin-top:10px">${
              d.type === "class" ? "No 1º nível" : "Traços"
            }</div>${feats
              .map(
                (f) =>
                  `<details class="item"><summary>${esc(
                    f.name
                  )}</summary><div class="rules">${
                    f.description || ""
                  }</div></details>`
              )
              .join("")}`
          : ""
      }
      <details class="item"><summary>${
        table ? "Texto completo" : "Descrição"
      }</summary><div class="rules">${
      table ? html.replace(table, "") : html
    }</div></details></div>`;
  };

  const decisionsFor = (root, byLevel) => {
    const list = R.decisions(SRD, state.c).filter((d) => d.root === root);
    if (!list.length) return "";
    if (!byLevel)
      return `<div class="title" style="margin-top:16px">Suas escolhas</div>${list
        .map(decisionHTML)
        .join("")}`;
    const lvls = [...new Set(list.map((d) => Math.max(1, d.advLevel)))].sort(
      (a, b) => a - b
    );
    return lvls
      .map(
        (l) =>
          `<div class="title" style="margin-top:16px">Escolhas do nível ${l}</div>${list
            .filter((d) => Math.max(1, d.advLevel) === l)
            .map(decisionHTML)
            .join("")}`
      )
      .join("");
  };

  const spellPicker = (c) =>
    R.spellLimits(SRD, c)
      .map((l) => {
        const cant = l.list.filter((id) => doc(id).level === 0);
        const sp = l.list.filter(
          (id) => doc(id).level >= 1 && doc(id).level <= l.maxLevel
        );
        const cc = c.spells.known.filter((id) => cant.includes(id));
        const pc = c.spells.prepared.filter((id) => sp.includes(id));
        return `<div class="title" style="margin-top:16px">Magias de ${esc(
          doc(l.classId).name
        )} <span class="right sub">atributo ${
          R.ABILITY_LABEL[l.ability]
        }</span></div>
          ${
            l.cantrips
              ? `<div class="frame decision"><h3><span class="st ${
                  cc.length >= l.cantrips ? "ok" : ""
                }"></span>Truques <span class="sub">${cc.length} de ${
                  l.cantrips
                }</span></h3>${docOptions(
                  "truques-" + l.classId,
                  cant,
                  cc,
                  "spell",
                  `data-field="known" data-limit="${l.cantrips}" data-pool="truques-${l.classId}"`
                )}</div>`
              : ""
          }
          ${
            l.prepared
              ? `<div class="frame decision"><h3><span class="st ${
                  pc.length >= l.prepared ? "ok" : ""
                }"></span>Magias preparadas <span class="sub">${pc.length} de ${
                  l.prepared
                }, até o ${l.maxLevel}º círculo</span></h3>${docOptions(
                  "preparadas-" + l.classId,
                  sp,
                  pc,
                  "spell",
                  `data-field="prepared" data-limit="${l.prepared}"`
                )}</div>`
              : ""
          }`;
      })
      .join("");

  const builderView = () => {
    const c = state.c;
    const step = STEPS[state.step];
    const docsOf = (type) =>
      Object.values(SRD.docs)
        .filter((d) => d.type === type && d.pack !== "equipment24")
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    let body = "";
    if (step.id === "inicio") {
      body = `<div class="split"><div class="frame">
          <label class="lbl" for="b-name">Nome do personagem</label><input class="field" id="b-name" data-bind="name" autocomplete="off" value="${esc(
            c.name
          )}">
          <label class="lbl" for="b-player">Jogador</label><input class="field" id="b-player" data-bind="player" value="${esc(
            c.player || ""
          )}">
          <label class="lbl" for="b-al">Alinhamento</label><input class="field" id="b-al" data-bind="details.alignment" placeholder="Ex.: Neutro e Bom" value="${esc(
            c.details.alignment || ""
          )}">
        </div><div class="frame" style="text-align:center">
          <div class="title">Retrato</div><div style="display:grid;place-items:center;margin:8px 0 18px">${portrait(
            c
          )}</div>
          <label class="btn" for="portrait-file" style="display:inline-grid;place-items:center">Escolher imagem</label>
          <input id="portrait-file" type="file" accept="image/*" style="display:none">
          ${
            c.portrait
              ? `<button class="btn ghost" data-act="no-portrait">Remover</button>`
              : ""
          }
          <p class="sub">A imagem é reduzida e fica salva na ficha.</p></div></div>`;
    } else if (step.id === "especie" || step.id === "antecedente") {
      const isSp = step.id === "especie";
      const sel = isSp ? c.speciesId : c.backgroundId;
      const items = docsOf(isSp ? "race" : "background");
      const cards = items
        .map((d) =>
          optCard(
            d,
            d.id === sel,
            isSp ? "setspecies" : "setbg",
            isSp
              ? R.SPECIES_LORE[d.identifier]
              : R.BACKGROUND_LORE[d.identifier],
            isSp
              ? [
                  ["Desloc.", m((d.movement && d.movement.walk) || 30)],
                  [
                    "Visão",
                    d.senses && d.senses.darkvision
                      ? m(d.senses.darkvision)
                      : "—",
                  ],
                  [
                    "Tamanho",
                    (
                      (d.advancement || []).find((x) => x.type === "Size") || {
                        config: { sizes: ["med"] },
                      }
                    ).config.sizes
                      .map((z) => R.SIZE_LABEL[z])
                      .join(" ou "),
                  ],
                ]
              : (() => {
                  const skills = (d.advancement || []).flatMap((a) =>
                    a.type === "Trait"
                      ? (a.config.grants || [])
                          .filter((g) => g.startsWith("skills:"))
                          .map((g) => R.traitLabel(SRD, g))
                      : []
                  );
                  const feat = (d.advancement || [])
                    .flatMap((a) =>
                      a.type === "ItemGrant" ? a.config.items || [] : []
                    )
                    .map((id) => doc(id) && doc(id).name)[0];
                  return [
                    ["Perícias", skills.join(", ")],
                    ["Talento", feat],
                  ];
                })()
          )
        )
        .join("");
      body = `<p class="muted">${
        isSp
          ? "A espécie define tamanho, deslocamento e traços como visão no escuro ou resistências."
          : "O antecedente dá aumentos de atributo, perícias, uma ferramenta e um talento de origem."
      }</p>
        <div class="${
          sel ? "split" : ""
        }"><div><div class="pick">${cards}</div>${
        sel ? decisionsFor(isSp ? "species" : "background") : ""
      }</div>${sel ? detailPanel(doc(sel)) : ""}</div>`;
    } else if (step.id === "classe") {
      const sel = c.classes[0] && c.classes[0].classId;
      const cards = docsOf("class")
        .map((d) =>
          optCard(
            d,
            d.id === sel,
            "setclass",
            (R.CLASS_LORE[d.identifier] || {}).tagline,
            [
              ["Dado de Vida", d.hitDie],
              [
                "Principal",
                ((d.primaryAbility && d.primaryAbility.value) || [])
                  .map((k) => R.ABILITY_SHORT[k])
                  .join(
                    d.primaryAbility && d.primaryAbility.all ? " e " : " ou "
                  ),
              ],
              ["Papel", (R.CLASS_LORE[d.identifier] || {}).role],
            ]
          )
        )
        .join("");
      const lvl = c.classes[0] ? c.classes[0].level : 1;
      body = `${
        sel
          ? `<div class="frame" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px">
            <span style="flex:1 1 220px"><span style="font-size:15px;font-weight:800">Nível inicial</span><span class="sub" style="display:block">Comece no nível que a campanha pede; as escolhas de cada nível aparecem abaixo.</span></span>
            <button class="btn" data-act="startlvl" data-d="-1" aria-label="Diminuir nível">−</button><b style="font-size:26px;min-width:36px;text-align:center">${lvl}</b><button class="btn" data-act="startlvl" data-d="1" aria-label="Aumentar nível">+</button></div>`
          : ""
      }
        <div class="${
          sel ? "split" : ""
        }"><div><div class="pick">${cards}</div>${
        sel ? decisionsFor("class", true) + spellPicker(c) : ""
      }</div>${sel ? detailPanel(doc(sel)) : ""}</div>`;
    } else if (step.id === "atributos") {
      body = abilitiesStep(c);
    } else if (step.id === "equipamento") {
      const t = eqTrees(c);
      const ch = c.equipmentChoice || {};
      const panel = (title, d, roots) =>
        `<div class="frame"><div class="title">${title}${
          d ? ` <span class="right sub">${esc(d.name)}</span>` : ""
        }</div>${
          d
            ? roots.map((n) => eqNode(n, ch)).join("")
            : '<p class="muted">Escolha antes no passo correspondente.</p>'
        }</div>`;
      body = `<p class="muted">Fique com o kit (A) ou leve o valor em ouro (B) e compre o que quiser.</p>
        <div class="split" style="grid-template-columns:1fr 1fr">${panel(
          "Da classe",
          c.classes[0] && doc(c.classes[0].classId),
          t.cls
        )}${panel(
        "Do antecedente",
        c.backgroundId && doc(c.backgroundId),
        t.bg
      )}</div>`;
    } else {
      body = reviewStep(c);
    }
    const last = state.step === STEPS.length - 1;
    return `<div class="wrap">
      <div class="bhead"><button class="btn ghost" data-act="home">${icon(
        "back",
        15
      )}Fichas</button>
        <h1>Criação de personagem</h1>
        <span class="sub" style="margin-left:auto" id="save-status">${esc(
          store.status
        )}</span></div>
      <nav class="stepper" aria-label="Passos">${STEPS.map((s, i) => {
        const done = s.done(c);
        const on = i === state.step;
        return `<button class="stp ${on ? "on" : ""} ${
          done ? "done" : ""
        }" data-act="step" data-i="${i}" aria-current="${
          on ? "step" : "false"
        }">
          <span class="b">${
            done && !on ? icon("check", 14) : `<span>${i + 1}</span>`
          }</span>
          <span class="t"><span class="n">Passo ${
            i + 1
          }</span><span class="l">${s.title}</span><span class="st">${
          on ? "Em andamento" : done ? "Concluído" : "Pendente"
        }</span></span>
        </button>`;
      }).join("")}<span class="rail"><div style="width:${Math.round(
      (STEPS.filter((x) => x.done(c)).length / STEPS.length) * 100
    )}%"></div></span></nav>
      <div class="progress-line"><b>${
        STEPS.filter((x) => x.done(c)).length
      } de ${STEPS.length}</b> passos concluídos</div>
      <div class="step-title"><h2>${step.title}</h2><span class="sub">Passo ${
      state.step + 1
    } de ${STEPS.length}</span></div>
      ${body}
      <div class="nav"><button class="btn" data-act="step" data-i="${
        state.step - 1
      }" ${state.step === 0 ? "disabled" : ""}>${icon(
      "back",
      15
    )}Anterior</button>
        ${
          last
            ? `<button class="btn red" data-act="finish" ${
                STEPS.every((s) => s.done(c)) ? "" : "disabled"
              }>${icon("check", 15)}Concluir Ficha</button>`
            : `<button class="btn red" data-act="step" data-i="${
                state.step + 1
              }">Próximo: ${STEPS[state.step + 1].title}</button>`
        }</div>
    </div>`;
  };

  const eqNode = (n, ch) => {
    if (n.type === "OR") {
      const picked = n.children.find((x) => x.id === ch[n.id]);
      return `<div style="margin:6px 0">${n.children
        .map(
          (x, i) =>
            `<button class="frame opt ${
              picked && picked.id === x.id ? "on" : ""
            }" style="width:100%;margin-bottom:6px" data-act="eqor" data-node="${
              n.id
            }" data-child="${
              x.id
            }"><span class="ico" style="font-size:20px;font-weight:800">${String.fromCharCode(
              65 + i
            )}</span><span>${esc(R.describeNode(SRD, x))}</span></button>`
        )
        .join("")}${
        picked ? picked.children.map((x) => eqNode(x, ch)).join("") : ""
      }</div>`;
    }
    if (n.type === "AND") return n.children.map((x) => eqNode(x, ch)).join("");
    if (["tool", "focus", "weapon", "armor"].includes(n.type))
      return `<div style="margin:4px 0 10px"><div class="sub cond" style="${
        ch[n.id] ? "" : "color:var(--red2)"
      }">${ch[n.id] ? "Escolhido" : "Falta escolher"}: ${esc(
        R.describeNode(SRD, n)
      )}</div>${R.categoryItems(SRD, n)
        .map(
          (d) =>
            `<button class="chip ${
              ch[n.id] === d.id ? "on" : ""
            }" data-act="eqcat" data-node="${n.id}" data-id="${d.id}">${esc(
              d.name
            )}</button>`
        )
        .join("")}</div>`;
    return "";
  };

  const PRIORITY = ["con", "dex", "wis", "str", "int", "cha"];
  const assign = (primary, values) => {
    const order = [...primary, ...PRIORITY.filter((k) => !primary.includes(k))];
    return Object.fromEntries(order.map((k, i) => [k, values[i]]));
  };
  const primaryOf = (c) =>
    (c.classes[0] &&
      doc(c.classes[0].classId).primaryAbility &&
      doc(c.classes[0].classId).primaryAbility.value) ||
    [];

  const abilitiesStep = (c) => {
    const fin = R.abilityScores(SRD, c);
    const prim = primaryOf(c);
    const used = R.ABILITIES.map((k) => c.abilities[k]);
    const opts =
      c.abilityMethod === "standard"
        ? R.STANDARD_ARRAY
        : [...used].sort((a, b) => b - a);
    const methods = [
      ["standard", "Conjunto padrão"],
      ["pointbuy", "Compra de pontos"],
      ["roll", "Rolar 4d6"],
      ["manual", "Digitar"],
    ];
    return `<p class="muted">${
      prim.length
        ? `Atributo principal da classe: ${prim
            .map((k) => R.ABILITY_LABEL[k])
            .join(" ou ")}. Coloque nele o valor mais alto.`
        : "Escolha a classe para ver o atributo principal."
    }</p>
      <div>${methods
        .map(
          ([k, l]) =>
            `<button class="chip ${
              c.abilityMethod === k ? "on" : ""
            }" data-act="method" data-m="${k}">${l}</button>`
        )
        .join("")}</div>
      ${
        c.abilityMethod === "pointbuy"
          ? `<p class="${
              R.pointBuySpent(c.abilities) > 27 ? "" : "muted"
            }" style="${
              R.pointBuySpent(c.abilities) > 27 ? "color:var(--red2)" : ""
            }">${27 - R.pointBuySpent(c.abilities)} de 27 pontos restantes.</p>`
          : ""
      }
      <div class="abilities">${R.ABILITIES.map((k) => {
        let ctl = "";
        if (c.abilityMethod === "standard" || c.abilityMethod === "roll")
          ctl = `<select class="field" data-act-change="absel" data-ab="${k}" aria-label="Valor base de ${
            R.ABILITY_LABEL[k]
          }">${opts
            .map(
              (v) =>
                `<option value="${v}" ${
                  v === c.abilities[k] ? "selected" : ""
                }>${v}</option>`
            )
            .join("")}</select>`;
        else if (c.abilityMethod === "pointbuy")
          ctl = `<div style="display:flex;gap:4px;justify-content:center"><button class="btn small" data-act="pb" data-ab="${k}" data-d="-1" aria-label="Diminuir">−</button><b style="min-width:26px">${c.abilities[k]}</b><button class="btn small" data-act="pb" data-ab="${k}" data-d="1" aria-label="Aumentar">+</button></div>`;
        else
          ctl = `<input class="field" id="ab-${k}" type="number" inputmode="numeric" min="3" max="20" data-bind="abilities.${k}" data-num value="${c.abilities[k]}" style="text-align:center">`;
        return `<div class="frame ab" style="${
          prim.includes(k) ? "border-color:var(--red2)" : ""
        }"><div class="k">${R.ABILITY_SHORT[k]}</div><div class="n">${
          R.ABILITY_LABEL[k]
        }</div>
          <div class="m">${sg(
            R.modifier(fin[k])
          )}</div><div class="sub">total ${fin[k]}${
          fin[k] !== c.abilities[k]
            ? ` (base ${c.abilities[k]} ${sg(fin[k] - c.abilities[k])})`
            : ""
        }</div><div style="margin-top:6px">${ctl}</div></div>`;
      }).join("")}</div>`;
  };

  const reviewStep = (c) => {
    const s = R.sheet(SRD, c);
    const missing = STEPS.slice(0, -1)
      .map((x, i) => [x, i])
      .filter(([x]) => !x.done(c));
    const skills = Object.entries(s.skills)
      .filter(([, v]) => v.proficient)
      .map(([k, v]) => `${R.SKILLS[k].label} ${sg(v.bonus)}`);
    const block = (title, html) =>
      `<div class="frame"><div class="title">${title}</div>${html}</div>`;
    return `${
      missing.length
        ? `<div class="banner"><b class="cond">Falta pouco:</b> ${missing
            .map(
              ([x, i]) =>
                `<button class="btn small" data-act="step" data-i="${i}">${x.title}</button>`
            )
            .join(" ")}</div>`
        : ""
    }
      <div class="frame head">${portrait(c)}<div class="who"><h1>${esc(
      c.name || "Sem nome"
    )}</h1><div class="line">${esc(classLine(c))}</div></div></div>
      <div class="abilities">${R.ABILITIES.map(
        (k) =>
          `<div class="frame ab"><div class="k">${
            R.ABILITY_SHORT[k]
          }</div><div class="m">${sg(s.modifiers[k])}</div><div class="s">${
            s.scores[k]
          }</div></div>`
      ).join("")}</div>
      <div class="stats" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));margin-bottom:12px">
        ${[
          ["CA", s.ac],
          ["Pontos de Vida", s.maxHp],
          ["Iniciativa", sg(s.initiative)],
          ["Deslocamento", m(s.speed)],
          ["Proficiência", sg(s.proficiencyBonus)],
          ["Percepção passiva", s.passivePerception],
        ]
          .map(
            ([l, v]) =>
              `<div class="frame stat"><div class="v">${v}</div><div class="l">${l}</div></div>`
          )
          .join("")}</div>
      <div class="split" style="grid-template-columns:1fr 1fr">
        ${block("Perícias", esc(skills.join(", ") || "Nenhuma"))}
        ${block(
          "Ataques",
          s.attacks
            .map(
              (a) =>
                `<div class="row"><span class="nm">${esc(
                  a.name
                )}</span><span class="hit" style="color:var(--red2)">${sg(
                  a.toHit
                )}</span><span class="sub">${esc(a.damage)}</span></div>`
            )
            .join("")
        )}
        ${block(
          "Magias",
          esc(
            spellIds(c)
              .map((id) => doc(id).name)
              .join(", ") || "Nenhuma"
          )
        )}
        ${block(
          "Equipamento",
          esc(
            c.inventory
              .map((i) => (i.itemId ? doc(i.itemId).name : i.name))
              .join(", ") || "Nada"
          ) + (c.currency.gp ? ` · ${c.currency.gp} PO` : "")
        )}
      </div>`;
  };

  // ---------------------------------------------------------------- subir de nível
  const levelUpView = () => {
    const c = state.c;
    const lu = state.ui.levelup;
    if (lu.stage === "pick") {
      const faces = lu.classId ? Number(doc(lu.classId).hitDie.slice(1)) : 0;
      return `<div class="wrap"><div class="bhead"><button class="btn ghost" data-act="lu-cancel">Cancelar</button><h1 class="cond" style="margin:0;font-size:26px">Subir para o nível ${
        R.totalLevel(c) + 1
      }</h1></div>
        <p class="muted">Escolha a classe que ganha o nível. Multiclasse exige 13 no atributo principal das duas classes.</p>
        <div class="pick">${Object.values(SRD.docs)
          .filter((d) => d.type === "class")
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map((d) => {
            const cur = c.classes.find((e) => e.classId === d.id);
            const ok = R.canMulticlassInto(SRD, c, d.id);
            return optCard(
              d,
              lu.classId === d.id,
              ok ? "lu-class" : "noop",
              cur
                ? `Nível ${cur.level} → ${cur.level + 1}`
                : ok
                ? "Nova classe (multiclasse)"
                : "Requisito de atributo não atendido"
            );
          })
          .join("")}</div>
        ${
          lu.classId
            ? `<div class="frame" style="margin-top:12px"><div class="title">${icon(
                "heart",
                15
              )}Pontos de Vida</div>
          <button class="chip ${
            lu.roll == null ? "on" : ""
          }" data-act="lu-avg">Média: ${R.averageHitDie(
                SRD,
                lu.classId
              )}</button>
          <button class="chip ${
            lu.roll != null ? "on" : ""
          }" data-act="lu-roll" data-f="${faces}">${
                lu.roll != null
                  ? "Rolei " + lu.roll + ". Rolar de novo"
                  : "Rolar " + doc(lu.classId).hitDie
              }</button>
          <p class="sub">A Constituição soma depois.</p></div>`
            : ""
        }
        <div class="nav"><span></span><button class="btn red" data-act="lu-apply" ${
          lu.classId ? "" : "disabled"
        }>Subir de nível</button></div></div>`;
    }
    const lastClass =
      c.classes.find((e) => e.classId === lu.classId) ||
      c.classes[c.classes.length - 1];
    const ds = R.decisions(SRD, c).filter(
      (d) =>
        !R.isDecisionDone(d) ||
        (d.classIndex !== null &&
          c.classes[d.classIndex] === lastClass &&
          d.advLevel === lastClass.level)
    );
    const needSpells = !spellsDone(c);
    return `<div class="wrap"><div class="bhead"><h1 class="cond" style="margin:0;font-size:26px">Escolhas do nível ${R.totalLevel(
      c
    )}</h1></div>
      ${
        ds.length
          ? ds.map(decisionHTML).join("")
          : '<p class="muted">Nenhuma escolha neste nível. As novas características já estão na ficha.</p>'
      }
      ${needSpells ? spellPicker(c) : ""}
      <div class="nav"><span></span><button class="btn red" data-act="lu-done" ${
        R.decisions(SRD, c).some((d) => !R.isDecisionDone(d)) ? "disabled" : ""
      }>Voltar à ficha</button></div></div>`;
  };

  // ---------------------------------------------------------------- ações
  const toggle = (list, val, limit) =>
    list.includes(val)
      ? list.filter((x) => x !== val)
      : limit === 1
      ? [val]
      : list.length < limit
      ? [...list, val]
      : list;

  const actions = {
    open: (el) => {
      const c = store.list.find((x) => x.id === el.dataset.id);
      const incomplete = !R.totalLevel(c) || !c.name.trim();
      go((incomplete ? "/criar/" : "/ficha/") + c.id);
    },
    sample: () => go("/exemplo"),
    new: () => go("/criar/" + uid() + "/0"),
    home: () => go("/"),
    adopt: () => {
      const c = clone(state.c);
      c.id = uid();
      c.name = c.name + " (cópia)";
      state.sample = false;
      state.c = c;
      store.save(c);
      store.list.unshift(c);
      go("/ficha/" + c.id);
    },
    tab: (el) => {
      state.tab = el.dataset.t;
      state.ui.manageSpells = false;
      render();
    },
    filter: (el) => {
      state.filter = el.dataset.f;
      render();
    },
    manage: () => go("/criar/" + state.c.id + "/0"),
    "rest-short": () => {
      state.c = R.shortRest(state.c);
      commit();
    },
    "rest-long": () => {
      state.c = R.longRest(SRD, state.c);
      commit();
    },
    insp: () => {
      state.c.state.inspiration = !state.c.state.inspiration;
      commit();
    },
    hp: (el) => {
      const c = state.c;
      const n = Math.max(
        0,
        parseInt(document.getElementById("hp-amt").value, 10) || 0
      );
      if (!n) return;
      const max = R.sheet(SRD, c).maxHp;
      const hp = Math.min(c.state.hp == null ? max : c.state.hp, max);
      if (el.dataset.mode === "heal") {
        c.state.hp = Math.min(max, hp + n);
        c.state.deathSaves = { success: 0, failure: 0 };
      } else if (el.dataset.mode === "dmg") {
        const fromTemp = Math.min(c.state.temp, n);
        c.state.temp -= fromTemp;
        c.state.hp = Math.max(0, hp - (n - fromTemp));
      } else c.state.temp = Math.max(c.state.temp, n);
      document.getElementById("hp-amt").value = "";
      commit();
    },
    hd: (el) => {
      const used = state.c.state.hitDiceSpent[el.dataset.cls] || 0;
      const i = Number(el.dataset.i);
      state.c.state.hitDiceSpent[el.dataset.cls] = i < used ? i : i + 1;
      commit();
    },
    death: (el) => {
      const k = el.dataset.k;
      const i = Number(el.dataset.i);
      state.c.state.deathSaves[k] = i < state.c.state.deathSaves[k] ? i : i + 1;
      commit();
    },
    exh: (el) => {
      const i = Number(el.dataset.i);
      state.c.state.exhaustion = i < state.c.state.exhaustion ? i : i + 1;
      commit();
    },
    cond: (el) => {
      const k = el.dataset.k;
      const cs = state.c.state.conditions;
      state.c.state.conditions = cs.includes(k)
        ? cs.filter((x) => x !== k)
        : [...cs, k];
      commit();
    },
    slot: (el) => {
      const l = el.dataset.l;
      const i = Number(el.dataset.i);
      const used = state.c.state.slotsSpent[l] || 0;
      state.c.state.slotsSpent[l] = i < used ? i : i + 1;
      commit();
    },
    pact: (el) => {
      const i = Number(el.dataset.i);
      state.c.state.pactSpent = i < state.c.state.pactSpent ? i : i + 1;
      commit();
    },
    use: (el) => {
      const k = el.dataset.k;
      const i = Number(el.dataset.i);
      const used = state.c.state.uses[k] || 0;
      state.c.state.uses[k] = i < used ? i : i + 1;
      commit();
    },
    equip: (el) => {
      const it = state.c.inventory.find((x) => x.uid === el.dataset.uid);
      it.equipped = !it.equipped;
      commit();
    },
    qty: (el) => {
      const inv = state.c.inventory;
      const it = inv.find((x) => x.uid === el.dataset.uid);
      it.quantity += Number(el.dataset.d);
      if (it.quantity <= 0) state.c.inventory = inv.filter((x) => x !== it);
      commit();
    },
    additem: (el) => {
      state.c.inventory.push({
        uid: el.dataset.id + "-" + Date.now(),
        itemId: el.dataset.id,
        quantity: 1,
      });
      state.ui.q.item = "";
      commit();
    },
    "manage-spells": () => {
      state.ui.manageSpells = !state.ui.manageSpells;
      render();
    },
    delete: async () => {
      if (
        !window.confirm(
          `Excluir a ficha de ${
            state.c.name || "personagem sem nome"
          }? Não dá para desfazer.`
        )
      )
        return;
      await store.remove(state.c.id);
      store.list = store.list.filter((x) => x.id !== state.c.id);
      go("/");
    },
    levelup: () => {
      state.ui.levelup = {
        stage: R.totalLevel(state.c) >= 20 ? "choices" : "pick",
        classId: null,
        roll: null,
      };
      render();
      window.scrollTo(0, 0);
    },
    "levelup-choices": () => {
      state.ui.levelup = { stage: "choices", classId: null, roll: null };
      render();
    },
    "lu-cancel": () => {
      state.ui.levelup = null;
      render();
    },
    "lu-class": (el) => {
      state.ui.levelup.classId = el.dataset.id;
      state.ui.levelup.roll = null;
      render();
    },
    "lu-avg": () => {
      state.ui.levelup.roll = null;
      render();
    },
    "lu-roll": (el) => {
      state.ui.levelup.roll =
        1 + Math.floor(Math.random() * Number(el.dataset.f));
      render();
    },
    "lu-apply": () => {
      const lu = state.ui.levelup;
      const before = R.sheet(SRD, state.c).maxHp;
      const next = R.levelUp(
        SRD,
        state.c,
        lu.classId,
        lu.roll != null ? lu.roll : R.averageHitDie(SRD, lu.classId)
      );
      const after = R.sheet(SRD, next).maxHp;
      next.state.hp = Math.min(
        after,
        (state.c.state.hp == null ? before : state.c.state.hp) +
          (after - before)
      );
      state.c = next;
      lu.stage = "choices";
      commit();
      window.scrollTo(0, 0);
    },
    "lu-done": () => {
      state.ui.levelup = null;
      render();
    },
    noop: () => {},
    // decisões
    pick: (el) => {
      const d = findDecision(el.dataset.key);
      if (!d) return;
      state.c.choices[d.key] = toggle(
        d.chosen,
        el.dataset.val,
        Math.min(d.count, d.options.length)
      );
      commit();
    },
    size: (el) => {
      state.c.choices[el.dataset.key] = [el.dataset.val];
      commit();
    },
    asi: (el) => {
      const d = findDecision(el.dataset.key);
      const cur = Object.assign({}, state.c.asi[d.key] || {});
      const k = el.dataset.ab;
      const delta = Number(el.dataset.d);
      const v = (cur[k] || 0) + delta;
      const spent = Object.values(cur).reduce((s, x) => s + (x || 0), 0);
      const score = R.abilityScores(SRD, state.c)[k];
      if (v < 0 || v > d.cap) return;
      if (delta > 0 && (spent >= d.points || score + delta > 20)) return;
      if (v) cur[k] = v;
      else delete cur[k];
      state.c.asi[d.key] = cur;
      state.c.choices[d.key] = [];
      commit();
    },
    asifeat: (el) => {
      const key = el.dataset.key;
      const cur = (state.c.choices[key] || [])[0];
      state.c.choices[key] = cur === el.dataset.val ? [] : [el.dataset.val];
      state.c.asi[key] = {};
      commit();
    },
    subclass: (el) => {
      state.c.classes[Number(el.dataset.idx)].subclassId = el.dataset.val;
      commit();
    },
    desc: (el) => {
      state.ui.open[el.dataset.k] = !state.ui.open[el.dataset.k];
      render();
    },
    lvlfilter: (el) => {
      state.ui.lvl[el.dataset.key] =
        el.dataset.v === "" ? null : Number(el.dataset.v);
      render();
    },
    spell: (el) => {
      const field = el.dataset.field;
      const limit = Number(el.dataset.limit);
      const id = el.dataset.val;
      const c = state.c;
      const l = R.spellLimits(SRD, c).find((x) =>
        el.dataset.key.endsWith(x.classId)
      );
      const pool =
        field === "known"
          ? l.list.filter((x) => doc(x).level === 0)
          : l.list.filter((x) => doc(x).level >= 1);
      const mine = c.spells[field].filter((x) => pool.includes(x));
      const next = toggle(mine, id, limit);
      c.spells[field] = [
        ...c.spells[field].filter((x) => !pool.includes(x)),
        ...next,
      ];
      commit();
    },
    // builder
    step: (el) => {
      const i = Number(el.dataset.i);
      if (i < 0 || i >= STEPS.length) return;
      go("/criar/" + state.c.id + "/" + i);
    },
    setspecies: (el) => {
      state.c.speciesId = el.dataset.id;
      commit();
    },
    setbg: (el) => {
      state.c.backgroundId = el.dataset.id;
      if (state.c.equipmentChoice) applyEquipment(state.c, {});
      commit();
    },
    setclass: (el) => {
      const c = state.c;
      if (c.classes[0] && c.classes[0].classId === el.dataset.id) return;
      const lvl = c.classes[0] ? c.classes[0].level : 1;
      c.classes = [];
      c.spells = { known: [], prepared: [] };
      const next = R.levelUp(SRD, c, el.dataset.id, 0);
      next.classes[0].level = lvl;
      next.classes[0].hitPoints = Array.from({ length: lvl - 1 }, () =>
        R.averageHitDie(SRD, el.dataset.id)
      );
      if (!abilitiesValid(next)) {
        next.abilityMethod = "standard";
        next.abilities = assign(primaryOf(next), R.STANDARD_ARRAY);
      }
      applyEquipment(next, {});
      state.c = next;
      commit();
    },
    startlvl: (el) => {
      const e = state.c.classes[0];
      const lvl = Math.max(1, Math.min(20, e.level + Number(el.dataset.d)));
      e.level = lvl;
      e.hitPoints = Array.from(
        { length: lvl - 1 },
        (_, i) => e.hitPoints[i] || R.averageHitDie(SRD, e.classId)
      );
      commit();
    },
    method: (el) => {
      const c = state.c;
      const mth = el.dataset.m;
      if (mth === "roll") {
        const d6 = () => 1 + Math.floor(Math.random() * 6);
        const vals = R.ABILITIES.map(() => {
          const r = [d6(), d6(), d6(), d6()].sort((a, b) => a - b);
          return r[1] + r[2] + r[3];
        }).sort((a, b) => b - a);
        c.abilities = assign(primaryOf(c), vals);
      } else if (mth === "pointbuy")
        c.abilities = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
      else if (mth === "standard")
        c.abilities = assign(primaryOf(c), R.STANDARD_ARRAY);
      c.abilityMethod = mth;
      commit();
    },
    pb: (el) => {
      const k = el.dataset.ab;
      const v = state.c.abilities[k] + Number(el.dataset.d);
      if (v < 8 || v > 15) return;
      state.c.abilities[k] = v;
      commit();
    },
    eqor: (el) => {
      const ch = Object.assign({}, state.c.equipmentChoice || {}, {
        [el.dataset.node]: el.dataset.child,
      });
      applyEquipment(state.c, ch);
      commit();
    },
    eqcat: (el) => {
      const ch = Object.assign({}, state.c.equipmentChoice || {}, {
        [el.dataset.node]: el.dataset.id,
      });
      applyEquipment(state.c, ch);
      commit();
    },
    "no-portrait": () => {
      delete state.c.portrait;
      commit();
    },
    finish: () => {
      state.c.state.hp = R.sheet(SRD, state.c).maxHp;
      store.save(state.c);
      const i = store.list.findIndex((x) => x.id === state.c.id);
      if (i >= 0) store.list[i] = clone(state.c);
      else store.list.unshift(clone(state.c));
      go("/ficha/" + state.c.id);
    },
  };

  const setPath = (obj, path, value) => {
    const keys = path.split(".");
    let o = obj;
    for (const k of keys.slice(0, -1)) o = o[k] = o[k] || {};
    o[keys[keys.length - 1]] = value;
  };

  $app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName === "SELECT") return;
    const fn = actions[el.dataset.act];
    if (fn) {
      e.preventDefault();
      fn(el);
    }
  });
  $app.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.actChange === "absel") {
      const c = state.c;
      const k = el.dataset.ab;
      const v = Number(el.value);
      const other = R.ABILITIES.find((x) => x !== k && c.abilities[x] === v);
      if (other) c.abilities[other] = c.abilities[k];
      c.abilities[k] = v;
      commit();
    }
    if (el.id === "portrait-file" && el.files && el.files[0]) {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const cv = document.createElement("canvas");
        cv.width = cv.height = size;
        const s = Math.min(img.width, img.height);
        cv.getContext("2d").drawImage(
          img,
          (img.width - s) / 2,
          (img.height - s) / 2,
          s,
          s,
          0,
          0,
          size,
          size
        );
        state.c.portrait = cv.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(img.src);
        commit();
      };
      img.src = URL.createObjectURL(el.files[0]);
    }
  });
  $app.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.bind && state.c) {
      setPath(
        state.c,
        el.dataset.bind,
        "num" in el.dataset ? Number(el.value) || 0 : el.value
      );
      commit();
    } else if (el.dataset.bindUi) {
      setPath(state.ui, el.dataset.bindUi, el.value);
      render();
    }
  });
  $app.addEventListener("submit", async (e) => {
    if (e.target.dataset.form !== "login") return;
    e.preventDefault();
    localStorage.setItem(
      "fichas.password",
      JSON.stringify(document.getElementById("pw").value)
    );
    try {
      const auth = await api("/auth");
      if (!auth.role) throw new Error();
      store.mode = "online";
      await store.load();
      route();
    } catch (err) {
      document.getElementById("login-err").textContent =
        "Senha incorreta. Confira com o mestre e tente de novo.";
    }
  });
  window.addEventListener("hashchange", route);

  // ---------------------------------------------------------------- início e sincronização
  (async () => {
    try {
      if (window.location.protocol === "file:")
        throw new Error("arquivo local");
      const auth = await api("/auth");
      store.mode = auth.role ? "online" : "login";
    } catch (e) {
      // aberto como arquivo ou sem o servidor da mesa: guarda neste aparelho
      store.mode = e.code === 401 ? "login" : "offline";
    }
    if (store.mode !== "login")
      await store.load().catch(() => (store.mode = "offline"));
    route();
    setInterval(async () => {
      if (store.mode !== "online" || document.visibilityState !== "visible")
        return;
      try {
        const list = await api("/characters");
        store.list = list.sort((a, b) =>
          (b.updatedAt || "").localeCompare(a.updatedAt || "")
        );
        if (state.c && !state.sample && !state.dirty) {
          const remote = store.list.find((x) => x.id === state.c.id);
          if (
            remote &&
            remote.updatedAt &&
            remote.updatedAt !== state.c.updatedAt &&
            !(
              document.activeElement &&
              document.activeElement.matches("input,textarea")
            )
          ) {
            state.c = clone(remote);
            render();
          }
        } else if (state.view === "list") render();
      } catch (e) {
        /* sem conexão: tenta de novo no próximo ciclo */
      }
    }, 4000);
  })();
})();
