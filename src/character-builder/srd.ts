// Tipos e rótulos do conteúdo SRD 5.2 (CC-BY-4.0) gerado por character-builder/scripts.

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: AbilityKey[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

export type Advancement = {
  id: string;
  type:
    | "HitPoints"
    | "ItemGrant"
    | "ItemChoice"
    | "AbilityScoreImprovement"
    | "ScaleValue"
    | "Trait"
    | "Subclass"
    | "Size"
    | "ModifyItem";
  level?: number;
  title?: string;
  hint?: string;
  classRestriction?: "primary" | "secondary";
  config: any;
};

export type SrdDoc = {
  id: string;
  pack: string;
  type: string;
  name: string;
  nameEn?: string;
  identifier?: string;
  description?: string;
  advancement?: Advancement[];
  // classe
  hitDie?: string;
  primaryAbility?: { value: AbilityKey[]; all: boolean };
  spellcasting?: { progression: string; ability: AbilityKey | "" };
  wealth?: string;
  startingEquipment?: StartingEquipment[];
  // subclasse
  classIdentifier?: string;
  // espécie
  movement?: Record<string, string>;
  senses?: Record<string, number | null>;
  creatureType?: string;
  // talento / característica
  featType?: { value: string; subtype: string };
  prerequisites?: { level: number | null; repeatable: boolean };
  requirements?: string;
  // magia
  level?: number;
  school?: string;
  properties?: string[];
  materials?: string;
  activation?: { type: string; value: number | null; condition?: string };
  range?: {
    value: string | number | null;
    units: string;
    long?: number | null;
    special?: string;
    reach?: number | null;
  };
  duration?: { value: string; units: string };
  // equipamento
  price?: { value: number; denomination: string };
  weight?: number;
  rarity?: string;
  itemType?: { value: string; baseItem?: string };
  damage?: {
    number: number | null;
    denomination: number;
    types: string[];
    bonus?: string;
  };
  versatile?: { number: number | null; denomination: number };
  mastery?: string;
  armor?: { value: number; dex: number | null; magicalBonus?: number | null };
  strength?: number;
  contents?: { name: string; quantity: number; id: string | null }[];
};

export type StartingEquipment = {
  id: string;
  type:
    | "AND"
    | "OR"
    | "linked"
    | "currency"
    | "weapon"
    | "armor"
    | "tool"
    | "focus";
  group?: string;
  count?: number | null;
  key?: string;
  requiresProficiency?: boolean;
};

export type Srd = {
  meta: Record<string, string>;
  docs: Record<string, SrdDoc>;
  spellLists: Record<string, string[]>;
};

let cached: Promise<Srd> | null = null;
export const loadSrd = (): Promise<Srd> =>
  (cached ??= fetch("srd52.json").then((r) => {
    if (!r.ok) throw new Error("Falha ao carregar as regras: " + r.status);
    return r.json();
  }));

export const ABILITY_LABEL: Record<AbilityKey, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
};
export const ABILITY_SHORT: Record<AbilityKey, string> = {
  str: "FOR",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
};

export const SKILLS: Record<string, { ability: AbilityKey; label: string }> = {
  acr: { ability: "dex", label: "Acrobacia" },
  ani: { ability: "wis", label: "Adestrar Animais" },
  arc: { ability: "int", label: "Arcanismo" },
  ath: { ability: "str", label: "Atletismo" },
  dec: { ability: "cha", label: "Enganação" },
  his: { ability: "int", label: "História" },
  ins: { ability: "wis", label: "Intuição" },
  itm: { ability: "cha", label: "Intimidação" },
  inv: { ability: "int", label: "Investigação" },
  med: { ability: "wis", label: "Medicina" },
  nat: { ability: "int", label: "Natureza" },
  prc: { ability: "wis", label: "Percepção" },
  prf: { ability: "cha", label: "Atuação" },
  per: { ability: "cha", label: "Persuasão" },
  rel: { ability: "int", label: "Religião" },
  slt: { ability: "dex", label: "Prestidigitação" },
  ste: { ability: "dex", label: "Furtividade" },
  sur: { ability: "wis", label: "Sobrevivência" },
};

export const LANGUAGES: Record<string, { label: string; rare?: boolean }> = {
  common: { label: "Comum" },
  sign: { label: "Língua de Sinais Comum" },
  draconic: { label: "Dracônico" },
  dwarvish: { label: "Anão" },
  elvish: { label: "Élfico" },
  giant: { label: "Gigante" },
  gnomish: { label: "Gnômico" },
  goblin: { label: "Goblin" },
  halfling: { label: "Pequenino" },
  orc: { label: "Orc" },
  abyssal: { label: "Abissal", rare: true },
  celestial: { label: "Celestial", rare: true },
  deep: { label: "Dialeto Subterrâneo", rare: true },
  druidic: { label: "Druídico", rare: true },
  infernal: { label: "Infernal", rare: true },
  primordial: { label: "Primordial", rare: true },
  sylvan: { label: "Silvestre", rare: true },
  cant: { label: "Gíria de Ladrão", rare: true },
  undercommon: { label: "Subcomum", rare: true },
};

export const ARMOR_LABEL: Record<string, string> = {
  lgt: "Armaduras leves",
  med: "Armaduras médias",
  hvy: "Armaduras pesadas",
  shl: "Escudos",
};
export const WEAPON_LABEL: Record<string, string> = {
  sim: "Armas simples",
  mar: "Armas marciais",
};
export const TOOL_CATEGORY_LABEL: Record<string, string> = {
  art: "Ferramentas de artesão",
  music: "Instrumentos musicais",
  game: "Jogos",
};

export const DAMAGE_LABEL: Record<string, string> = {
  acid: "Ácido",
  bludgeoning: "Contundente",
  cold: "Frio",
  fire: "Fogo",
  force: "Energético",
  lightning: "Elétrico",
  necrotic: "Necrótico",
  piercing: "Perfurante",
  poison: "Venenoso",
  psychic: "Psíquico",
  radiant: "Radiante",
  slashing: "Cortante",
  thunder: "Trovejante",
};

export const CONDITIONS: Record<string, string> = {
  blinded: "Cego",
  charmed: "Enfeitiçado",
  deafened: "Surdo",
  frightened: "Amedrontado",
  grappled: "Agarrado",
  incapacitated: "Incapacitado",
  invisible: "Invisível",
  paralyzed: "Paralisado",
  petrified: "Petrificado",
  poisoned: "Envenenado",
  prone: "Caído",
  restrained: "Contido",
  stunned: "Atordoado",
  unconscious: "Inconsciente",
};

export const SCHOOL_LABEL: Record<string, string> = {
  abj: "Abjuração",
  con: "Conjuração",
  div: "Adivinhação",
  enc: "Encantamento",
  evo: "Evocação",
  ill: "Ilusão",
  nec: "Necromancia",
  trs: "Transmutação",
};

export const SIZE_LABEL: Record<string, string> = {
  tiny: "Miúdo",
  sm: "Pequeno",
  med: "Médio",
  lg: "Grande",
  huge: "Enorme",
  grg: "Imenso",
};

export const WEAPON_PROPERTY_LABEL: Record<string, string> = {
  fin: "Acuidade",
  lgt: "Leve",
  hvy: "Pesada",
  ver: "Versátil",
  thr: "Arremesso",
  two: "Duas Mãos",
  rch: "Alcance",
  amm: "Munição",
  lod: "Recarga",
};

export const MASTERY_LABEL: Record<string, string> = {
  cleave: "Trespassar",
  graze: "Raspar",
  nick: "Ágil",
  push: "Empurrar",
  sap: "Enfraquecer",
  slow: "Lentidão",
  topple: "Derrubar",
  vex: "Irritar",
};

/** 5 pés = 1,5 m, como nos livros brasileiros. */
export const feetToMeters = (feet: number) =>
  `${(feet * 0.3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m`;

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
