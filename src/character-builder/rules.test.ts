import * as fs from "fs";
import * as path from "path";
import type { Srd } from "./srd";
import {
  Character,
  decisions,
  emptyCharacter,
  isDecisionDone,
  levelUp,
  sheet,
  spellSlots,
} from "./rules";

const srd: Srd = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../character-builder/fonte/srd52.en.json"),
    "utf8"
  )
);
const byIdentifier = (type: string, identifier: string) => {
  const doc = Object.values(srd.docs).find(
    (d) => d.type === type && d.identifier === identifier && !d.rarity
  );
  if (!doc) throw new Error(`${type} ${identifier} não encontrado`);
  return doc.id;
};
const item = (identifier: string) =>
  Object.values(srd.docs).find((d) => d.identifier === identifier && !d.rarity)!
    .id;

const build = (classes: [string, number][], patch: Partial<Character> = {}) => {
  let c: Character = {
    ...emptyCharacter("t"),
    abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    ...patch,
  };
  for (const [cls, level] of classes) {
    const id = byIdentifier("class", cls);
    for (let i = 0; i < level; i++) c = levelUp(srd, c, id, 0);
  }
  // nos testes os níveis extras valem a média do dado
  c.classes = c.classes.map((e, idx) => ({
    ...e,
    hitPoints: e.hitPoints.map(
      () => Number(srd.docs[e.classId].hitDie!.slice(1)) / 2 + 1
    ),
  }));
  return c;
};

it("mago humano sábio de nível 1: decisões, PV e magias", () => {
  const c = build([["wizard", 1]], {
    speciesId: byIdentifier("race", "human"),
    backgroundId: byIdentifier("background", "sage"),
    abilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
  });
  const pending = decisions(srd, c);
  const titles = pending.map((d) => d.title);
  // perícias da classe, aumento do antecedente, idiomas, perícia do humano e talento versátil
  expect(pending.find((d) => d.kind === "asi" && d.background)).toBeTruthy();
  expect(titles).toContain("Skill Proficiencies");
  expect(
    pending.some((d) => d.kind === "pick" && d.title === "Versatile")
  ).toBe(true);
  expect(pending.every((d) => d.kind !== "subclass")).toBe(true);

  const s = sheet(srd, c);
  expect(s.proficiencyBonus).toBe(2);
  expect(s.maxHp).toBe(6 + 1);
  expect(s.saves.int.proficient && s.saves.wis.proficient).toBe(true);
  expect(s.skills.arc.proficient && s.skills.his.proficient).toBe(true); // do antecedente
  expect(s.spellcasting[0]).toMatchObject({
    cantrips: 3,
    prepared: 4,
    maxLevel: 1,
    dc: 8 + 2 + 2,
  });
  expect(spellSlots(srd, c).slots).toEqual([2]);
});

it("escolhas de traço resolvem a decisão e somem das outras listas", () => {
  let c = build([["wizard", 1]], {
    backgroundId: byIdentifier("background", "sage"),
  });
  const skills = decisions(srd, c).find(
    (d) => d.kind === "pick" && d.title === "Skill Proficiencies"
  )!;
  expect(skills.kind === "pick" && skills.options).not.toContain("skills:arc"); // já vem do antecedente
  c = {
    ...c,
    choices: { ...c.choices, [skills.key]: ["skills:ins", "skills:med"] },
  };
  const after = decisions(srd, c).find((d) => d.key === skills.key)!;
  expect(isDecisionDone(after)).toBe(true);
  expect(sheet(srd, c).skills.ins.proficient).toBe(true);
});

it("subclasse no nível 3 e aumento de atributo no nível 4", () => {
  const c = build([["wizard", 4]]);
  const pending = decisions(srd, c);
  const sub = pending.find((d) => d.kind === "subclass");
  expect(sub && sub.kind === "subclass" && sub.options.length).toBeGreaterThan(
    0
  );
  expect(pending.filter((d) => d.kind === "asi" && !d.background)).toHaveLength(
    1
  );
  const asi = pending.find((d) => d.kind === "asi" && !d.background)!;
  const withAsi = { ...c, asi: { [asi.key]: { int: 2 } } };
  expect(sheet(srd, withAsi).scores.int).toBe(14);
  expect(
    isDecisionDone(decisions(srd, withAsi).find((d) => d.key === asi.key)!)
  ).toBe(true);
});

it("guerreiro de nível 5 com cota de malha e escudo", () => {
  const chain = item("chain-mail");
  const shield = item("shield");
  const longsword = item("longsword");
  const c = build([["fighter", 5]], {
    inventory: [
      { uid: "1", itemId: chain, quantity: 1, equipped: true },
      { uid: "2", itemId: shield, quantity: 1, equipped: true },
      { uid: "3", itemId: longsword, quantity: 1, equipped: true },
    ],
  });
  const s = sheet(srd, c);
  expect(s.ac).toBe(18);
  expect(s.proficiencyBonus).toBe(3);
  expect(s.maxHp).toBe(10 + 4 * 6 + 1 * 5);
  const sword = s.attacks.find((a) => a.damageType === "slashing")!;
  expect(sword.toHit).toBe(2 + 3);
  expect(sword.damage).toBe("1d8 + 2");
  expect(s.features.some((f) => f.doc.identifier === "extra-attack")).toBe(
    true
  );
});

it("bárbaro sem armadura usa DES + CON", () => {
  const s = sheet(srd, build([["barbarian", 1]]));
  expect(s.ac).toBe(10 + 2 + 1);
  expect(s.scales.find((x) => x.identifier === "barbarian.")?.value).toBe(2); // Fúrias
});

it("multiclasse paladino 2 / feiticeiro 3 soma níveis de conjurador", () => {
  const c = build(
    [
      ["paladin", 2],
      ["sorcerer", 3],
    ],
    {
      abilities: { str: 13, dex: 10, con: 14, int: 8, wis: 10, cha: 15 },
    }
  );
  expect(spellSlots(srd, c).slots).toEqual([4, 3]);
  // o secundário não ganha os testes de resistência do feiticeiro
  const s = sheet(srd, c);
  expect(s.saves.wis.proficient && s.saves.cha.proficient).toBe(true);
  expect(s.saves.con.proficient).toBe(false);
});

it("bruxo de nível 5 tem 2 espaços de pacto de 3º círculo", () => {
  expect(spellSlots(srd, build([["warlock", 5]])).pact).toEqual({
    count: 2,
    level: 3,
  });
});

it("anão ganha 1 PV por nível", () => {
  const c = build([["fighter", 2]], {
    speciesId: byIdentifier("race", "dwarf"),
  });
  expect(sheet(srd, c).maxHp).toBe(10 + 6 + 2 * 1 + 2);
});
