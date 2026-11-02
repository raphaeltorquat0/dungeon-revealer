// Motor de regras do Character Builder (SRD 5.2). Funções puras: dado o SRD e a ficha, calcula as decisões
// pendentes e a ficha derivada. A criação e o subir de nível usam o mesmo mecanismo de decisões.
import {
  ABILITIES,
  AbilityKey,
  Advancement,
  LANGUAGES,
  SKILLS,
  Srd,
  SrdDoc,
} from "./srd";

export type ClassEntry = {
  classId: string;
  subclassId?: string;
  level: number;
  /** PV ganhos em cada nível depois do primeiro desta classe (valor do dado, sem CON). */
  hitPoints: number[];
};

export type InventoryItem = {
  uid: string;
  itemId?: string;
  name?: string;
  quantity: number;
  equipped?: boolean;
};

export type Character = {
  id: string;
  name: string;
  player?: string;
  speciesId?: string;
  backgroundId?: string;
  abilityMethod: "standard" | "pointbuy" | "roll" | "manual";
  /** Valores base, antes de antecedente e aumentos. */
  abilities: Record<AbilityKey, number>;
  classes: ClassEntry[];
  /** Escolhas por decisão (chave de decisão → valores escolhidos). */
  choices: Record<string, string[]>;
  /** Aumentos de atributo por decisão (antecedente e aumentos de classe). */
  asi: Record<string, Partial<Record<AbilityKey, number>>>;
  equipmentChoice?: Record<string, string>;
  inventory: InventoryItem[];
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };
  spells: { known: string[]; prepared: string[] };
  state: {
    hp: number | null;
    temp: number;
    hitDiceSpent: Record<string, number>;
    slotsSpent: Record<string, number>;
    pactSpent: number;
    uses: Record<string, number>;
    conditions: string[];
    exhaustion: number;
    inspiration: boolean;
    deathSaves: { success: number; failure: number };
  };
  details: {
    alignment?: string;
    appearance?: string;
    backstory?: string;
    notes?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

export const emptyCharacter = (id: string): Character => ({
  id,
  name: "",
  abilityMethod: "standard",
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  classes: [],
  choices: {},
  asi: {},
  inventory: [],
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  spells: { known: [], prepared: [] },
  state: {
    hp: null,
    temp: 0,
    hitDiceSpent: {},
    slotsSpent: {},
    pactSpent: 0,
    uses: {},
    conditions: [],
    exhaustion: 0,
    inspiration: false,
    deathSaves: { success: 0, failure: 0 },
  },
  details: {},
});

export const modifier = (score: number) => Math.floor((score - 10) / 2);
export const proficiencyBonus = (level: number) =>
  2 + Math.floor((Math.max(1, level) - 1) / 4);
export const totalLevel = (c: Character) =>
  c.classes.reduce((sum, e) => sum + e.level, 0);
export const dieFaces = (die?: string) => parseInt((die ?? "d8").slice(1), 10);

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
export const pointBuySpent = (a: Record<AbilityKey, number>) =>
  ABILITIES.reduce((sum, k) => sum + (POINT_BUY_COST[a[k]] ?? 99), 0);

// ---------------------------------------------------------------------------
// Avanços ativos: percorre espécie, antecedente, classes, subclasses e tudo o que eles concedem.

export type ActiveAdvancement = {
  doc: SrdDoc;
  adv: Advancement;
  /** Nível que vale para este avanço (nível da classe dona, ou 0 para origem). */
  level: number;
  classIndex: number | null;
  key: string;
};

const advKey = (doc: SrdDoc, adv: Advancement) => `${doc.id}/${adv.id}`;

export const activeAdvancements = (
  srd: Srd,
  c: Character
): ActiveAdvancement[] => {
  const out: ActiveAdvancement[] = [];
  const visited = new Set<string>();

  const walk = (
    docId: string | undefined,
    level: number,
    classIndex: number | null,
    // características de classe usam o nível da classe; o próprio documento de origem usa 0
    gate: (adv: Advancement) => boolean
  ) => {
    const doc = docId ? srd.docs[docId] : undefined;
    if (!doc || visited.has(`${doc.id}@${classIndex}`)) return;
    visited.add(`${doc.id}@${classIndex}`);
    for (const adv of doc.advancement ?? []) {
      if (!gate(adv)) continue;
      const entry = {
        doc,
        adv,
        level,
        classIndex,
        key: advKey(doc, adv),
      };
      out.push(entry);
      const children: string[] = [];
      if (adv.type === "ItemGrant") children.push(...(adv.config.items ?? []));
      if (adv.type === "ItemChoice")
        children.push(...(c.choices[entry.key] ?? []));
      if (adv.type === "AbilityScoreImprovement")
        children.push(
          ...(c.choices[entry.key] ?? []).filter((id) => srd.docs[id])
        );
      for (const child of children) {
        walk(
          child,
          level,
          classIndex,
          (a) => (a.level ?? 0) <= Math.max(level, 0)
        );
      }
    }
  };

  walk(c.speciesId, 0, null, (a) => (a.level ?? 0) <= 0);
  walk(c.backgroundId, 0, null, (a) => (a.level ?? 0) <= 0);
  c.classes.forEach((entry, index) => {
    const gate = (a: Advancement) => {
      if ((a.level ?? 1) > entry.level) return false;
      if (a.classRestriction === "primary" && index !== 0) return false;
      if (a.classRestriction === "secondary" && index === 0) return false;
      return true;
    };
    walk(entry.classId, entry.level, index, gate);
    walk(entry.subclassId, entry.level, index, gate);
  });
  return out;
};

// ---------------------------------------------------------------------------
// Opções de escolha

const weaponItems = (srd: Srd) =>
  Object.values(srd.docs).filter(
    (d) =>
      d.type === "weapon" &&
      !d.rarity &&
      /^(simple|martial)[MR]$/.test(d.itemType?.value ?? "")
  );

const toolItems = (srd: Srd) =>
  Object.values(srd.docs).filter((d) => d.type === "tool" && !d.rarity);

/** Expande um pool de traços ("skills:*", "weapon:mar:*", "languages:standard:*") em chaves concretas. */
export const expandTraitPool = (srd: Srd, pool: string[]): string[] => {
  const out: string[] = [];
  for (const key of pool) {
    const [kind, sub, rest] = key.split(":");
    if (kind === "skills" && sub === "*") {
      out.push(...Object.keys(SKILLS).map((s) => `skills:${s}`));
    } else if (kind === "languages" && (sub === "*" || rest === "*")) {
      for (const [lang, info] of Object.entries(LANGUAGES)) {
        if (sub === "standard" && info.rare) continue;
        out.push(`languages:${info.rare ? "exotic" : "standard"}:${lang}`);
      }
    } else if (kind === "weapon" && (sub === "*" || rest === "*")) {
      for (const w of weaponItems(srd)) {
        const cat = w.itemType!.value.startsWith("simple") ? "sim" : "mar";
        if (sub !== "*" && sub !== cat) continue;
        if (w.itemType?.baseItem)
          out.push(`weapon:${cat}:${w.itemType.baseItem}`);
      }
    } else if (kind === "tool" && (sub === "*" || rest === "*")) {
      for (const t of toolItems(srd)) {
        const cat = t.itemType?.value ?? "";
        if (sub !== "*" && sub !== cat) continue;
        const base = t.itemType?.baseItem;
        if (base) out.push(cat ? `tool:${cat}:${base}` : `tool:${base}`);
      }
    } else {
      out.push(key);
    }
  }
  return [...new Set(out)];
};

/** Documentos que satisfazem a restrição de um ItemChoice sem pool (talentos, estilos de luta, magias...). */
const restrictedOptions = (
  srd: Srd,
  restriction: any,
  type: string
): string[] => {
  if (!restriction) return [];
  if (type === "spell" || restriction.list?.length) {
    const lists: string[] = (restriction.list ?? []).map((l: string) =>
      l.replace("class:", "")
    );
    const level =
      restriction.level === "available" ? null : Number(restriction.level ?? 0);
    const ids = new Set(lists.flatMap((l) => srd.spellLists[l] ?? []));
    return [...ids].filter(
      (id) => level === null || srd.docs[id]?.level === level
    );
  }
  return Object.values(srd.docs)
    .filter(
      (d) =>
        d.type === "feat" &&
        (!restriction.type || d.featType?.value === restriction.type) &&
        (!restriction.subtype || d.featType?.subtype === restriction.subtype)
    )
    .map((d) => d.id);
};

// ---------------------------------------------------------------------------
// Decisões

export type Decision =
  | {
      kind: "pick";
      key: string;
      title: string;
      hint?: string;
      source: SrdDoc;
      count: number;
      options: string[];
      optionKind: "trait" | "doc";
      mode?: "expertise" | "mastery" | "default";
      chosen: string[];
    }
  | {
      kind: "asi";
      key: string;
      title: string;
      hint?: string;
      source: SrdDoc;
      /** Antecedente: 3 pontos em atributos liberados; classe: 2 pontos ou um talento. */
      background: boolean;
      allowed: AbilityKey[];
      points: number;
      cap: number;
      featOptions: string[];
      done: boolean;
    }
  | {
      kind: "subclass";
      key: string;
      title: string;
      classIndex: number;
      source: SrdDoc;
      options: string[];
      done: boolean;
    }
  | {
      kind: "size";
      key: string;
      title: string;
      hint?: string;
      source: SrdDoc;
      options: string[];
      done: boolean;
    };

const itemChoiceCount = (adv: Advancement, level: number) =>
  Object.entries(adv.config.choices ?? {}).reduce(
    (sum, [lvl, n]) =>
      Number(lvl) <= level ? sum + (typeof n === "number" ? n : 0) : sum,
    0
  );

export const decisions = (srd: Srd, c: Character): Decision[] => {
  const out: Decision[] = [];
  const active = activeAdvancements(srd, c);
  const proficient = traits(srd, c, active);

  for (const a of active) {
    const { doc, adv, key, level } = a;
    const title = adv.title || doc.name;
    if (adv.type === "Trait") {
      const mode = adv.config.mode ?? "default";
      (adv.config.choices ?? []).forEach((choice: any, i: number) => {
        let options = expandTraitPool(srd, choice.pool);
        if (mode === "expertise") {
          options = options.filter((o) => proficient.has(o));
        } else if (mode === "default") {
          // não oferecer o que já se tem por outra fonte (mantém o que esta decisão já escolheu)
          const mine = new Set(c.choices[`${key}#${i}`] ?? []);
          options = options.filter((o) => mine.has(o) || !proficient.has(o));
        }
        out.push({
          kind: "pick",
          key: `${key}#${i}`,
          title,
          hint: adv.hint,
          source: doc,
          count: choice.count,
          options,
          optionKind: "trait",
          mode,
          chosen: c.choices[`${key}#${i}`] ?? [],
        });
      });
    } else if (adv.type === "ItemChoice") {
      const count = itemChoiceCount(adv, level);
      if (!count) continue;
      const pool: string[] = adv.config.pool?.length
        ? adv.config.pool
        : restrictedOptions(srd, adv.config.restriction, adv.config.type);
      out.push({
        kind: "pick",
        key,
        title,
        hint: adv.hint,
        source: doc,
        count,
        options: pool.filter((id) => srd.docs[id]),
        optionKind: "doc",
        chosen: c.choices[key] ?? [],
      });
    } else if (adv.type === "AbilityScoreImprovement") {
      const background = doc.type === "background";
      const locked: string[] = adv.config.locked ?? [];
      const spent = Object.values(c.asi[key] ?? {}).reduce(
        (s, v) => s + (v ?? 0),
        0
      );
      const featChosen = (c.choices[key] ?? []).length > 0;
      const points = adv.config.points ?? 2;
      out.push({
        kind: "asi",
        key,
        title: background
          ? "Aumento de atributos do antecedente"
          : `Aumento no Valor de Atributo (nível ${adv.level})`,
        hint: adv.hint,
        source: doc,
        background,
        allowed: ABILITIES.filter((ab) => !locked.includes(ab)),
        points,
        cap: adv.config.cap ?? 2,
        featOptions: background
          ? []
          : Object.values(srd.docs)
              .filter(
                (d) =>
                  d.type === "feat" &&
                  d.featType?.value === "feat" &&
                  (d.featType.subtype === "general" ||
                    (adv.level === 19 && d.featType.subtype === "epicBoon")) &&
                  !(
                    d.prerequisites?.level &&
                    d.prerequisites.level > totalLevel(c)
                  )
              )
              .map((d) => d.id),
        done: featChosen || spent === points,
      });
    } else if (adv.type === "Subclass" && a.classIndex !== null) {
      const entry = c.classes[a.classIndex];
      const classDoc = srd.docs[entry.classId];
      out.push({
        kind: "subclass",
        key,
        title: "Subclasse",
        classIndex: a.classIndex,
        source: doc,
        options: Object.values(srd.docs)
          .filter(
            (d) =>
              d.type === "subclass" &&
              d.classIdentifier === classDoc?.identifier
          )
          .map((d) => d.id),
        done: Boolean(entry.subclassId),
      });
    } else if (adv.type === "Size" && (adv.config.sizes ?? []).length > 1) {
      out.push({
        kind: "size",
        key,
        title: "Tamanho",
        hint: adv.hint,
        source: doc,
        options: adv.config.sizes,
        done: (c.choices[key] ?? []).length === 1,
      });
    }
  }
  return out;
};

export const isDecisionDone = (d: Decision) =>
  d.kind === "pick"
    ? d.chosen.length >= Math.min(d.count, d.options.length)
    : d.done;

// ---------------------------------------------------------------------------
// Ficha derivada

/** Proficiências, idiomas e resistências concedidos (fixos e escolhidos). */
export const traits = (
  srd: Srd,
  c: Character,
  active = activeAdvancements(srd, c)
): Set<string> => {
  const set = new Set<string>();
  for (const { adv, key } of active) {
    if (adv.type !== "Trait") continue;
    const mode = adv.config.mode ?? "default";
    const add = (t: string) =>
      set.add(
        mode === "expertise"
          ? `expertise:${t}`
          : mode === "mastery"
          ? `mastery:${t}`
          : t
      );
    (adv.config.grants ?? []).forEach(add);
    (adv.config.choices ?? []).forEach((_: any, i: number) =>
      (c.choices[`${key}#${i}`] ?? []).forEach(add)
    );
  }
  return set;
};

export const abilityScores = (
  srd: Srd,
  c: Character
): Record<AbilityKey, number> => {
  const scores = { ...c.abilities };
  const active = activeAdvancements(srd, c);
  const keys = new Set(
    active
      .filter((a) => a.adv.type === "AbilityScoreImprovement")
      .map((a) => a.key)
  );
  for (const [key, inc] of Object.entries(c.asi)) {
    if (!keys.has(key)) continue;
    for (const ab of ABILITIES) scores[ab] += inc[ab] ?? 0;
  }
  // limite de 20, exceto Dádivas Épicas (até 30)
  for (const ab of ABILITIES) scores[ab] = Math.min(scores[ab], 30);
  return scores;
};

export type Scale = {
  title: string;
  value: string | number;
  type: string;
  source: SrdDoc;
  identifier: string;
};

export const scaleValues = (srd: Srd, c: Character): Scale[] =>
  activeAdvancements(srd, c)
    .filter((a) => a.adv.type === "ScaleValue")
    .map((a) => {
      const steps = Object.entries(a.adv.config.scale ?? {})
        .map(([lvl, v]) => [Number(lvl), v] as const)
        .filter(([lvl, v]) => lvl <= a.level && v !== null && v !== undefined)
        .sort((x, y) => x[0] - y[0]);
      const value = steps.length ? steps[steps.length - 1][1] : null;
      return {
        title: a.adv.title || a.doc.name,
        value: value as any,
        type: a.adv.config.type,
        source: a.doc,
        identifier: `${a.doc.identifier}.${a.adv.config.identifier || ""}`,
      };
    })
    .filter((s) => s.value !== null);

const FULL_CASTER_SLOTS = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const PACT_SLOTS = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
const PACT_LEVEL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

const casterLevel = (progression: string, level: number) =>
  progression === "full"
    ? level
    : progression === "half"
    ? Math.ceil(level / 2)
    : progression === "third"
    ? Math.floor(level / 3)
    : 0;

export const spellSlots = (srd: Srd, c: Character) => {
  const casters = c.classes.filter(
    (e) => srd.docs[e.classId]?.spellcasting?.progression !== "none"
  );
  const level = casters.reduce(
    (sum, e) =>
      sum +
      casterLevel(srd.docs[e.classId]!.spellcasting!.progression, e.level),
    0
  );
  const slots = level > 0 ? FULL_CASTER_SLOTS[Math.min(level, 20) - 1] : [];
  const warlock = c.classes.find(
    (e) => srd.docs[e.classId]?.spellcasting?.progression === "pact"
  );
  const pact = warlock
    ? {
        count: PACT_SLOTS[warlock.level - 1],
        level: PACT_LEVEL[warlock.level - 1],
      }
    : null;
  return { slots, pact };
};

/** Maior círculo de magia que esta classe consegue preparar sozinha. */
export const maxSpellLevelFor = (srd: Srd, entry: ClassEntry) => {
  const progression =
    srd.docs[entry.classId]?.spellcasting?.progression ?? "none";
  if (progression === "pact") return PACT_LEVEL[entry.level - 1];
  const lvl = casterLevel(progression, entry.level);
  return lvl > 0 ? FULL_CASTER_SLOTS[lvl - 1].length : 0;
};

export const spellLimits = (srd: Srd, c: Character) => {
  const scales = scaleValues(srd, c);
  return c.classes
    .map((entry, index) => {
      const doc = srd.docs[entry.classId];
      const sc = doc?.spellcasting;
      if (!doc || !sc || sc.progression === "none") return null;
      const find = (id: string) =>
        Number(
          scales.find((s) => s.identifier === `${doc.identifier}.${id}`)
            ?.value ?? 0
        );
      return {
        index,
        classId: entry.classId,
        ability: sc.ability as AbilityKey,
        cantrips: find("cantrips-known"),
        prepared: find("max-prepared"),
        maxLevel: maxSpellLevelFor(srd, entry),
        list: srd.spellLists[doc.identifier ?? ""] ?? [],
      };
    })
    .filter(Boolean) as {
    index: number;
    classId: string;
    ability: AbilityKey;
    cantrips: number;
    prepared: number;
    maxLevel: number;
    list: string[];
  }[];
};

/** Características, talentos e traços concedidos ou escolhidos, com o documento que os concedeu. */
export const grantedFeatures = (
  srd: Srd,
  c: Character,
  active = activeAdvancements(srd, c)
) =>
  active
    .filter(
      (a) =>
        a.adv.type === "ItemGrant" ||
        a.adv.type === "ItemChoice" ||
        a.adv.type === "AbilityScoreImprovement"
    )
    .flatMap((a) =>
      (
        (a.adv.type === "ItemGrant"
          ? a.adv.config.items
          : c.choices[a.key] ?? []) as string[]
      )
        .map((id) => srd.docs[id])
        .filter((d): d is SrdDoc => Boolean(d) && d.type === "feat")
        .map((doc) => ({ doc, source: a.doc }))
    );

export type Attack = {
  name: string;
  toHit: number;
  damage: string;
  damageType: string;
  properties: string[];
  mastery?: string;
  range?: string;
};

export const sheet = (srd: Srd, c: Character) => {
  const active = activeAdvancements(srd, c);
  const t = traits(srd, c, active);
  const scores = abilityScores(srd, c);
  const mod = (ab: AbilityKey) => modifier(scores[ab]);
  const level = totalLevel(c);
  const prof = proficiencyBonus(level);
  const features = grantedFeatures(srd, c, active);
  const featureIds = new Set(features.map((f) => f.doc.identifier));

  const saves = Object.fromEntries(
    ABILITIES.map((ab) => {
      const proficient = t.has(`saves:${ab}`);
      return [ab, { proficient, bonus: mod(ab) + (proficient ? prof : 0) }];
    })
  ) as Record<AbilityKey, { proficient: boolean; bonus: number }>;

  const skills = Object.fromEntries(
    Object.entries(SKILLS).map(([key, info]) => {
      const expertise = t.has(`expertise:skills:${key}`);
      const proficient = expertise || t.has(`skills:${key}`);
      return [
        key,
        {
          proficient,
          expertise,
          bonus:
            mod(info.ability) + (expertise ? 2 * prof : proficient ? prof : 0),
        },
      ];
    })
  ) as Record<
    string,
    { proficient: boolean; expertise: boolean; bonus: number }
  >;

  // PV: nível 1 da primeira classe no máximo do dado; depois o valor guardado de cada nível; + CON por nível
  const conMod = mod("con");
  let maxHp = 0;
  c.classes.forEach((entry, index) => {
    const faces = dieFaces(srd.docs[entry.classId]?.hitDie);
    const gained = entry.level - (index === 0 ? 1 : 0);
    if (index === 0 && entry.level > 0) maxHp += faces;
    for (let i = 0; i < gained; i++)
      maxHp += entry.hitPoints[i] ?? faces / 2 + 1;
  });
  maxHp += conMod * level;
  if (featureIds.has("dwarven-toughness")) maxHp += level;
  maxHp = Math.max(maxHp, level);

  // CA
  const equipped = c.inventory
    .filter((i) => i.equipped && i.itemId)
    .map((i) => srd.docs[i.itemId!])
    .filter(Boolean) as SrdDoc[];
  const armor = equipped.find((d) => d.armor && d.itemType?.value !== "shield");
  const shield = equipped.find((d) => d.itemType?.value === "shield");
  let ac = 10 + mod("dex");
  if (armor) {
    const cap =
      armor.itemType?.value === "heavy" ? 0 : armor.armor?.dex ?? null;
    ac =
      (armor.armor?.value ?? 10) +
      (cap === null ? mod("dex") : Math.min(mod("dex"), cap));
  } else if (
    featureIds.has("unarmored-defense") &&
    c.classes.some((e) => srd.docs[e.classId]?.identifier === "barbarian")
  ) {
    ac = 10 + mod("dex") + mod("con");
  } else if (featureIds.has("unarmored-defense") && !shield) {
    ac = 10 + mod("dex") + mod("wis");
  } else if (featureIds.has("draconic-resilience")) {
    ac = 10 + mod("dex") + mod("cha");
  }
  if (shield) ac += shield.armor?.value ?? 2;
  if (armor && featureIds.has("defense")) ac += 1;

  const species = c.speciesId ? srd.docs[c.speciesId] : undefined;
  const speed = Number(species?.movement?.walk ?? 30);
  const darkvision = Number(species?.senses?.darkvision ?? 0);

  // ataques: armas equipadas e ataque desarmado
  const attacks: Attack[] = equipped
    .filter((d) => d.type === "weapon")
    .map((w) => {
      const props = w.properties ?? [];
      const ranged = (w.itemType?.value ?? "").endsWith("R");
      const ability: AbilityKey = props.includes("fin")
        ? mod("dex") > mod("str")
          ? "dex"
          : "str"
        : ranged
        ? "dex"
        : "str";
      const cat = (w.itemType?.value ?? "").startsWith("simple")
        ? "sim"
        : "mar";
      const proficient =
        t.has(`weapon:${cat}`) ||
        t.has(`weapon:${cat}:${w.itemType?.baseItem}`);
      const dice = w.damage?.denomination
        ? `${w.damage.number ?? 1}d${w.damage.denomination}`
        : "1";
      const m = mod(ability);
      const mastery =
        w.mastery && t.has(`mastery:weapon:${cat}:${w.itemType?.baseItem}`)
          ? w.mastery
          : undefined;
      return {
        name: w.name,
        toHit: m + (proficient ? prof : 0),
        damage: m ? `${dice} ${m > 0 ? "+" : "−"} ${Math.abs(m)}` : dice,
        damageType: w.damage?.types?.[0] ?? "",
        properties: props,
        mastery,
        range: w.range?.value
          ? `${w.range.value}${w.range.long ? "/" + w.range.long : ""}`
          : undefined,
      };
    });
  const monk = c.classes.find(
    (e) => srd.docs[e.classId]?.identifier === "monk"
  );
  const martialDie = scaleValues(srd, c).find(
    (s) => s.identifier === "monk.die"
  )?.value;
  const unarmedAbility: AbilityKey =
    monk && mod("dex") > mod("str") ? "dex" : "str";
  attacks.push({
    name: "Ataque Desarmado",
    toHit: mod(unarmedAbility) + prof,
    damage:
      monk && martialDie
        ? `1${martialDie} ${signed2(mod(unarmedAbility))}`
        : `${Math.max(1, 1 + mod("str"))}`,
    damageType: "bludgeoning",
    properties: [],
  });

  const spellcasting = spellLimits(srd, c).map((s) => ({
    ...s,
    dc: 8 + prof + mod(s.ability),
    attack: prof + mod(s.ability),
  }));

  return {
    level,
    proficiencyBonus: prof,
    scores,
    modifiers: Object.fromEntries(
      ABILITIES.map((ab) => [ab, mod(ab)])
    ) as Record<AbilityKey, number>,
    saves,
    skills,
    maxHp,
    ac,
    initiative: mod("dex") + (featureIds.has("alert") ? prof : 0),
    speed,
    darkvision,
    passivePerception: 10 + skills.prc.bonus,
    attacks,
    traits: t,
    features,
    scales: scaleValues(srd, c),
    slots: spellSlots(srd, c),
    spellcasting,
    hitDice: c.classes.map((e) => ({
      die: srd.docs[e.classId]?.hitDie ?? "d8",
      count: e.level,
      classId: e.classId,
    })),
  };
};

const signed2 = (n: number) => (n === 0 ? "" : n > 0 ? `+ ${n}` : `− ${-n}`);

export type Sheet = ReturnType<typeof sheet>;

// ---------------------------------------------------------------------------
// Ações

export const canMulticlassInto = (srd: Srd, c: Character, classId: string) => {
  const scores = abilityScores(srd, c);
  const meets = (doc?: SrdDoc) => {
    const p = doc?.primaryAbility;
    if (!p || !p.value.length) return true;
    return p.all
      ? p.value.every((ab) => scores[ab] >= 13)
      : p.value.some((ab) => scores[ab] >= 13);
  };
  if (c.classes.some((e) => e.classId === classId)) return true;
  return (
    c.classes.every((e) => meets(srd.docs[e.classId])) &&
    meets(srd.docs[classId])
  );
};

/** Sobe um nível na classe indicada (nova ou existente). hp: valor do dado ganho (média ou rolagem). */
export const levelUp = (
  srd: Srd,
  c: Character,
  classId: string,
  hp: number
): Character => {
  const classes = c.classes.map((e) => ({ ...e, hitPoints: [...e.hitPoints] }));
  const existing = classes.find((e) => e.classId === classId);
  if (existing) {
    existing.level += 1;
    existing.hitPoints.push(hp);
  } else if (classes.length === 0) {
    classes.push({ classId, level: 1, hitPoints: [] });
  } else {
    classes.push({ classId, level: 1, hitPoints: [hp] });
  }
  return { ...c, classes };
};

export const averageHitDie = (srd: Srd, classId: string) =>
  dieFaces(srd.docs[classId]?.hitDie) / 2 + 1;

export const longRest = (srd: Srd, c: Character): Character => ({
  ...c,
  state: {
    ...c.state,
    hp: sheet(srd, c).maxHp,
    temp: 0,
    hitDiceSpent: {},
    slotsSpent: {},
    pactSpent: 0,
    uses: {},
    deathSaves: { success: 0, failure: 0 },
    exhaustion: Math.max(0, c.state.exhaustion - 1),
  },
});

export const shortRest = (c: Character): Character => ({
  ...c,
  state: { ...c.state, pactSpent: 0 },
});
