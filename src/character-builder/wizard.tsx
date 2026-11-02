import * as React from "react";
import {
  ABILITIES,
  ABILITY_LABEL,
  ABILITY_SHORT,
  AbilityKey,
  Srd,
  signed,
} from "./srd";
import {
  abilityScores,
  Character,
  decisions,
  isDecisionDone,
  levelUp,
  modifier,
  pointBuySpent,
  Root,
  sheet,
  spellLimits,
  STANDARD_ARRAY,
} from "./rules";
import { DecisionEditor, DocChoice } from "./decision";
import {
  categoryItems,
  describeNode,
  EquipmentNode,
  equipmentTree,
  pendingEquipment,
  resolveEquipment,
} from "./equipment";
import {
  BottomBar,
  Button,
  Chip,
  color,
  display,
  H1,
  H2,
  Input,
  Label,
  Lead,
  Muted,
  Page,
  TextArea,
} from "./theme";

type Step = {
  id: string;
  title: string;
  done: (c: Character) => boolean;
  render: () => React.ReactNode;
};

const rootDone = (srd: Srd, c: Character, root: Root) =>
  decisions(srd, c)
    .filter((d) => d.root === root)
    .every(isDecisionDone);

export const abilitiesValid = (c: Character) => {
  const values = ABILITIES.map((ab) => c.abilities[ab]);
  if (c.abilityMethod === "standard")
    return [...values].sort((a, b) => b - a).join() === STANDARD_ARRAY.join();
  if (c.abilityMethod === "pointbuy")
    return (
      values.every((v) => v >= 8 && v <= 15) && pointBuySpent(c.abilities) <= 27
    );
  return values.every((v) => v >= 3 && v <= 20);
};

export const Wizard = ({
  srd,
  character,
  onChange,
  onFinish,
  onExit,
}: {
  srd: Srd;
  character: Character;
  onChange: (c: Character) => void;
  onFinish: () => void;
  onExit: () => void;
}) => {
  const [stepIndex, setStepIndex] = React.useState(() =>
    character.classes.length ? 1 : 0
  );
  const c = character;
  const caster = spellLimits(srd, c).length > 0;

  const docsOfType = (type: string) =>
    Object.values(srd.docs)
      .filter((d) => d.type === type && d.pack !== "equipment24")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const classEquipment = equipmentTree(srd.docs[c.classes[0]?.classId]);
  const backgroundEquipment = equipmentTree(srd.docs[c.backgroundId ?? ""]);
  const equipmentChoice = c.equipmentChoice ?? {};
  const equipmentPending = [
    ...pendingEquipment(srd, classEquipment, equipmentChoice),
    ...pendingEquipment(srd, backgroundEquipment, equipmentChoice),
  ];

  const applyEquipment = (choice: Record<string, string>) => {
    const a = resolveEquipment(srd, classEquipment, choice);
    const b = resolveEquipment(srd, backgroundEquipment, choice);
    const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    for (const cur of [a.currency, b.currency])
      for (const [k, v] of Object.entries(cur))
        currency[k as keyof typeof currency] += v ?? 0;
    onChange({
      ...c,
      equipmentChoice: choice,
      inventory: [...a.items, ...b.items],
      currency,
    });
  };

  const decisionsFor = (root: Root) =>
    decisions(srd, c)
      .filter((d) => d.root === root)
      .map((d) => (
        <DecisionEditor
          key={d.key}
          srd={srd}
          character={c}
          decision={d}
          onChange={onChange}
        />
      ));

  const steps: Step[] = [
    {
      id: "classe",
      title: "Classe",
      done: () => c.classes.length > 0,
      render: () => (
        <>
          <Lead>
            A classe define o papel do personagem no grupo: o que ele faz em
            combate, que magia usa e como cresce.
          </Lead>
          {docsOfType("class").map((cls) => (
            <DocChoice
              key={cls.id}
              srd={srd}
              id={cls.id}
              selected={c.classes[0]?.classId === cls.id}
              subtitle={`Dado de Vida ${cls.hitDie}, atributo principal ${(
                cls.primaryAbility?.value ?? []
              )
                .map((ab) => ABILITY_LABEL[ab])
                .join(cls.primaryAbility?.all ? " e " : " ou ")}`}
              onSelect={() => {
                if (c.classes[0]?.classId === cls.id) return;
                // trocar de classe recomeça as escolhas da classe e o equipamento
                const base = {
                  ...c,
                  classes: [],
                  equipmentChoice: {},
                  inventory: [],
                  spells: { known: [], prepared: [] },
                };
                const next = levelUp(srd, base, cls.id, 0);
                // começa com o conjunto padrão já distribuído pela prioridade da classe
                onChange(
                  abilitiesValid(next)
                    ? next
                    : {
                        ...next,
                        abilityMethod: "standard",
                        abilities: suggested(cls.primaryAbility?.value ?? []),
                      }
                );
              }}
            />
          ))}
        </>
      ),
    },
    {
      id: "antecedente",
      title: "Antecedente",
      done: () => Boolean(c.backgroundId) && rootDone(srd, c, "background"),
      render: () => (
        <>
          <Lead>
            De onde o personagem vem. O antecedente dá aumentos de atributo,
            perícias, uma ferramenta e um talento de origem.
          </Lead>
          {docsOfType("background").map((bg) => (
            <DocChoice
              key={bg.id}
              srd={srd}
              id={bg.id}
              selected={c.backgroundId === bg.id}
              onSelect={() => onChange({ ...c, backgroundId: bg.id })}
            />
          ))}
          {c.backgroundId ? decisionsFor("background") : null}
        </>
      ),
    },
    {
      id: "especie",
      title: "Espécie",
      done: () => Boolean(c.speciesId) && rootDone(srd, c, "species"),
      render: () => (
        <>
          <Lead>
            A espécie define tamanho, deslocamento e traços como visão no escuro
            ou resistências.
          </Lead>
          {docsOfType("race").map((sp) => (
            <DocChoice
              key={sp.id}
              srd={srd}
              id={sp.id}
              selected={c.speciesId === sp.id}
              subtitle={`Deslocamento ${
                Number(sp.movement?.walk ?? 30) * 0.3
              } m${
                sp.senses?.darkvision
                  ? `, visão no escuro ${sp.senses.darkvision * 0.3} m`
                  : ""
              }`}
              onSelect={() => onChange({ ...c, speciesId: sp.id })}
            />
          ))}
          {c.speciesId ? decisionsFor("species") : null}
        </>
      ),
    },
    {
      id: "atributos",
      title: "Atributos",
      done: () => abilitiesValid(c),
      render: () => <AbilityStep srd={srd} character={c} onChange={onChange} />,
    },
    {
      id: "escolhas",
      title: "Escolhas da classe",
      done: () => rootDone(srd, c, "class"),
      render: () => {
        const list = decisionsFor("class");
        return list.length ? (
          <>{list}</>
        ) : (
          <Lead>Esta classe não pede outras escolhas no 1º nível.</Lead>
        );
      },
    },
    {
      id: "equipamento",
      title: "Equipamento",
      done: () => equipmentPending.length === 0,
      render: () => (
        <>
          <Lead>
            Escolha o equipamento inicial da classe e do antecedente. A
            alternativa em ouro deixa você comprar o que quiser.
          </Lead>
          {[
            ["Da classe", classEquipment],
            ["Do antecedente", backgroundEquipment],
          ].map(([label, roots]) => (
            <section key={label as string}>
              <H2>{label as string}</H2>
              {(roots as EquipmentNode[]).map((n) => (
                <EquipmentNodeEditor
                  key={n.id}
                  srd={srd}
                  node={n}
                  choice={equipmentChoice}
                  onChoice={applyEquipment}
                />
              ))}
            </section>
          ))}
        </>
      ),
    },
    ...(caster
      ? [
          {
            id: "magias",
            title: "Magias",
            done: () =>
              spellLimits(srd, c).every((l) => {
                const cantrips = c.spells.known.filter(
                  (id) => l.list.includes(id) && srd.docs[id]?.level === 0
                ).length;
                const prepared = c.spells.prepared.filter((id) =>
                  l.list.includes(id)
                ).length;
                return (
                  cantrips >= l.cantrips && prepared >= Math.min(l.prepared, 1)
                );
              }),
            render: () => (
              <SpellStep srd={srd} character={c} onChange={onChange} />
            ),
          },
        ]
      : []),
    {
      id: "detalhes",
      title: "Detalhes",
      done: () => c.name.trim().length > 0,
      render: () => (
        <>
          <Label htmlFor="nome">Nome do personagem</Label>
          <Input
            id="nome"
            value={c.name}
            autoComplete="off"
            onChange={(e) => onChange({ ...c, name: e.target.value })}
          />
          <Label htmlFor="jogador">Jogador</Label>
          <Input
            id="jogador"
            value={c.player ?? ""}
            onChange={(e) => onChange({ ...c, player: e.target.value })}
          />
          <Label htmlFor="alinhamento">Alinhamento</Label>
          <Input
            id="alinhamento"
            value={c.details.alignment ?? ""}
            placeholder="Ex.: Neutro e Bom"
            onChange={(e) =>
              onChange({
                ...c,
                details: { ...c.details, alignment: e.target.value },
              })
            }
          />
          <Label htmlFor="aparencia">Aparência</Label>
          <TextArea
            id="aparencia"
            value={c.details.appearance ?? ""}
            onChange={(e) =>
              onChange({
                ...c,
                details: { ...c.details, appearance: e.target.value },
              })
            }
          />
          <Label htmlFor="historia">História</Label>
          <TextArea
            id="historia"
            value={c.details.backstory ?? ""}
            onChange={(e) =>
              onChange({
                ...c,
                details: { ...c.details, backstory: e.target.value },
              })
            }
          />
        </>
      ),
    },
  ];

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const allDone = steps.every((s) => s.done(c));
  const go = (i: number) => {
    setStepIndex(i);
    window.scrollTo({ top: 0 });
  };

  return (
    <Page>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button tone="quiet" onClick={onExit} style={{ minHeight: 40 }}>
          Voltar às fichas
        </Button>
        <Muted style={{ fontSize: 14 }}>Salvo automaticamente</Muted>
      </div>
      {/* passos numerados: é de fato uma sequência */}
      <ol
        aria-label="Passos"
        style={{
          display: "flex",
          gap: 6,
          listStyle: "none",
          padding: 0,
          margin: "18px 0 6px",
          overflowX: "auto",
        }}
      >
        {steps.map((s, i) => {
          const current = i === stepIndex;
          const done = s.done(c);
          return (
            <li key={s.id} style={{ flex: "none" }}>
              <button
                onClick={() => go(i)}
                aria-current={current ? "step" : undefined}
                title={s.title}
                style={{
                  font: "inherit",
                  width: 36,
                  height: 36,
                  borderRadius: 36,
                  cursor: "pointer",
                  border: `1px solid ${
                    current || done ? color.gold : color.rule
                  }`,
                  background: done
                    ? color.gold
                    : current
                    ? color.goldSoft
                    : "transparent",
                  color: done ? color.night : color.ink,
                  fontWeight: 600,
                }}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      <H1>{step.title}</H1>
      {step.render()}
      <BottomBar>
        <Button disabled={stepIndex === 0} onClick={() => go(stepIndex - 1)}>
          Anterior
        </Button>
        {stepIndex < steps.length - 1 ? (
          <Button
            tone="primary"
            disabled={!step.done(c)}
            onClick={() => go(stepIndex + 1)}
          >
            Próximo
          </Button>
        ) : (
          <Button
            tone="primary"
            disabled={!allDone}
            onClick={() => {
              onChange({
                ...c,
                state: { ...c.state, hp: sheet(srd, c).maxHp },
              });
              onFinish();
            }}
          >
            Concluir ficha
          </Button>
        )}
      </BottomBar>
    </Page>
  );
};

const EquipmentNodeEditor = ({
  srd,
  node,
  choice,
  onChoice,
}: {
  srd: Srd;
  node: EquipmentNode;
  choice: Record<string, string>;
  onChoice: (choice: Record<string, string>) => void;
}): React.ReactElement | null => {
  if (node.type === "OR") {
    const picked = node.children.find((c) => c.id === choice[node.id]);
    return (
      <div style={{ margin: "8px 0" }}>
        {node.children.map((child, i) => (
          <button
            key={child.id}
            onClick={() => onChoice({ ...choice, [node.id]: child.id })}
            aria-pressed={picked?.id === child.id}
            style={{
              font: "inherit",
              display: "flex",
              gap: 12,
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              marginBottom: 8,
              borderRadius: 10,
              cursor: "pointer",
              color: color.ink,
              border: `1px solid ${
                picked?.id === child.id ? color.gold : color.rule
              }`,
              background:
                picked?.id === child.id ? color.goldSoft : color.vellum,
            }}
          >
            <span
              style={{
                fontFamily: display,
                color: color.gold,
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span>{describeNode(srd, child)}</span>
          </button>
        ))}
        {picked
          ? picked.children.map((n) => (
              <EquipmentNodeEditor
                key={n.id}
                srd={srd}
                node={n}
                choice={choice}
                onChoice={onChoice}
              />
            ))
          : null}
      </div>
    );
  }
  if (node.type === "AND")
    return (
      <>
        {node.children.map((n) => (
          <EquipmentNodeEditor
            key={n.id}
            srd={srd}
            node={n}
            choice={choice}
            onChoice={onChoice}
          />
        ))}
      </>
    );
  if (["tool", "focus", "weapon", "armor"].includes(node.type)) {
    const options = categoryItems(srd, node);
    return (
      <div style={{ margin: "6px 0 12px" }}>
        <Label as="div">Escolha {describeNode(srd, node)}</Label>
        {options.map((d) => (
          <Chip
            key={d.id}
            selected={choice[node.id] === d.id}
            onClick={() => onChoice({ ...choice, [node.id]: d.id })}
          >
            {d.name}
          </Chip>
        ))}
      </div>
    );
  }
  return null;
};

const AbilityStep = ({
  srd,
  character: c,
  onChange,
}: {
  srd: Srd;
  character: Character;
  onChange: (c: Character) => void;
}) => {
  const primary = srd.docs[c.classes[0]?.classId]?.primaryAbility?.value ?? [];
  const final = abilityScores(srd, c);
  const setMethod = (m: Character["abilityMethod"]) =>
    onChange({
      ...c,
      abilityMethod: m,
      abilities:
        m === "pointbuy"
          ? { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
          : m === "standard"
          ? suggested(primary)
          : c.abilities,
    });
  const set = (ab: AbilityKey, v: number) =>
    onChange({ ...c, abilities: { ...c.abilities, [ab]: v } });
  const roll = () => {
    const d6 = () => 1 + Math.floor(Math.random() * 6);
    const values = ABILITIES.map(() => {
      const r = [d6(), d6(), d6(), d6()].sort((a, b) => a - b);
      return r[1] + r[2] + r[3];
    }).sort((a, b) => b - a);
    onChange({
      ...c,
      abilityMethod: "roll",
      abilities: assign(primary, values),
    });
  };
  const used = ABILITIES.map((ab) => c.abilities[ab]);

  return (
    <>
      <Lead>
        {primary.length
          ? `O atributo principal da sua classe é ${primary
              .map((ab) => ABILITY_LABEL[ab])
              .join(" ou ")}. Coloque nele o valor mais alto.`
          : "Distribua os valores entre os seis atributos."}
      </Lead>
      <div>
        {(
          [
            ["standard", "Conjunto padrão"],
            ["pointbuy", "Compra de pontos"],
            ["roll", "Rolar 4d6"],
            ["manual", "Digitar"],
          ] as const
        ).map(([m, label]) => (
          <Chip
            key={m}
            selected={c.abilityMethod === m}
            onClick={() => (m === "roll" ? roll() : setMethod(m))}
          >
            {label}
          </Chip>
        ))}
      </div>
      {c.abilityMethod === "pointbuy" ? (
        <p
          style={{
            color: pointBuySpent(c.abilities) > 27 ? "#E7A0A9" : color.inkSoft,
          }}
        >
          {27 - pointBuySpent(c.abilities)} de 27 pontos restantes.
        </p>
      ) : null}
      {c.abilityMethod === "roll" ? (
        <p style={{ color: color.inkSoft }}>
          Valores rolados: {[...used].sort((a, b) => b - a).join(", ")}. Toque
          em Rolar 4d6 para rolar de novo.
        </p>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        {ABILITIES.map((ab) => (
          <div
            key={ab}
            style={{
              border: `1px solid ${
                primary.includes(ab) ? color.gold : color.rule
              }`,
              borderRadius: 12,
              padding: "10px 12px",
              background: color.vellum,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{ABILITY_LABEL[ab]}</span>
              <Muted>{ABILITY_SHORT[ab]}</Muted>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                margin: "4px 0",
              }}
            >
              <span style={{ fontSize: 34, fontWeight: 600 }}>{final[ab]}</span>
              <span style={{ color: color.gold }}>
                {signed(modifier(final[ab]))}
              </span>
            </div>
            {c.abilityMethod === "standard" || c.abilityMethod === "roll" ? (
              <select
                aria-label={`Valor base de ${ABILITY_LABEL[ab]}`}
                value={c.abilities[ab]}
                onChange={(e) => {
                  // troca com o atributo que tinha esse valor
                  const v = Number(e.target.value);
                  const other = ABILITIES.find(
                    (x) => x !== ab && c.abilities[x] === v
                  );
                  onChange({
                    ...c,
                    abilities: {
                      ...c.abilities,
                      [ab]: v,
                      ...(other ? { [other]: c.abilities[ab] } : {}),
                    },
                  });
                }}
                style={{
                  font: "inherit",
                  width: "100%",
                  minHeight: 40,
                  background: color.vellumHi,
                  color: color.ink,
                  border: `1px solid ${color.rule}`,
                  borderRadius: 8,
                }}
              >
                {(c.abilityMethod === "standard"
                  ? STANDARD_ARRAY
                  : [...used].sort((a, b) => b - a)
                ).map((v, i) => (
                  <option key={i} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : c.abilityMethod === "pointbuy" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <Chip
                  style={{ flex: 1, margin: 0 }}
                  onClick={() =>
                    c.abilities[ab] > 8 && set(ab, c.abilities[ab] - 1)
                  }
                  aria-label={`Diminuir ${ABILITY_LABEL[ab]}`}
                >
                  −
                </Chip>
                <Chip
                  style={{ flex: 1, margin: 0 }}
                  onClick={() =>
                    c.abilities[ab] < 15 && set(ab, c.abilities[ab] + 1)
                  }
                  aria-label={`Aumentar ${ABILITY_LABEL[ab]}`}
                >
                  +
                </Chip>
              </div>
            ) : (
              <Input
                type="number"
                inputMode="numeric"
                min={3}
                max={20}
                aria-label={`Valor base de ${ABILITY_LABEL[ab]}`}
                value={c.abilities[ab]}
                onChange={(e) => set(ab, Number(e.target.value))}
              />
            )}
            {final[ab] !== c.abilities[ab] ? (
              <Muted style={{ fontSize: 13 }}>
                base {c.abilities[ab]}, {signed(final[ab] - c.abilities[ab])} de
                bônus
              </Muted>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
};

// ordem sugerida: principal(is) primeiro, Constituição depois, Destreza em seguida
const priority = (primary: AbilityKey[]): AbilityKey[] => [
  ...primary,
  ...(["con", "dex", "wis", "str", "int", "cha"] as AbilityKey[]).filter(
    (ab) => !primary.includes(ab)
  ),
];
const assign = (primary: AbilityKey[], values: number[]) =>
  Object.fromEntries(
    priority(primary).map((ab, i) => [ab, values[i]])
  ) as Record<AbilityKey, number>;
const suggested = (primary: AbilityKey[]) => assign(primary, STANDARD_ARRAY);

const SpellStep = ({
  srd,
  character: c,
  onChange,
}: {
  srd: Srd;
  character: Character;
  onChange: (c: Character) => void;
}) => (
  <>
    {spellLimits(srd, c).map((l) => {
      const cantripIds = l.list.filter((id) => srd.docs[id]?.level === 0);
      const spellIds = l.list.filter(
        (id) =>
          (srd.docs[id]?.level ?? 0) >= 1 &&
          (srd.docs[id]?.level ?? 0) <= l.maxLevel
      );
      const chosenCantrips = c.spells.known.filter((id) =>
        cantripIds.includes(id)
      );
      const chosenPrepared = c.spells.prepared.filter((id) =>
        spellIds.includes(id)
      );
      const toggle = (
        field: "known" | "prepared",
        id: string,
        limit: number,
        current: string[]
      ) => {
        const list = c.spells[field];
        const next = list.includes(id)
          ? list.filter((x) => x !== id)
          : current.length < limit
          ? [...list, id]
          : list;
        onChange({ ...c, spells: { ...c.spells, [field]: next } });
      };
      return (
        <section key={l.classId}>
          <Lead>
            {srd.docs[l.classId].name}: atributo de conjuração{" "}
            {ABILITY_LABEL[l.ability]}.
          </Lead>
          {l.cantrips ? (
            <>
              <H2>Truques</H2>
              <Muted>
                {chosenCantrips.length} de {l.cantrips}
              </Muted>
              <div style={{ marginTop: 8 }}>
                {cantripIds.map((id) => (
                  <DocChoice
                    key={id}
                    srd={srd}
                    id={id}
                    selected={chosenCantrips.includes(id)}
                    onSelect={() =>
                      toggle("known", id, l.cantrips, chosenCantrips)
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
          {l.prepared ? (
            <>
              <H2>Magias preparadas</H2>
              <Muted>
                {chosenPrepared.length} de {l.prepared}, até o {l.maxLevel}º
                círculo
              </Muted>
              <div style={{ marginTop: 8 }}>
                {spellIds.map((id) => (
                  <DocChoice
                    key={id}
                    srd={srd}
                    id={id}
                    subtitle={`${srd.docs[id].level}º círculo`}
                    selected={chosenPrepared.includes(id)}
                    onSelect={() =>
                      toggle("prepared", id, l.prepared, chosenPrepared)
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      );
    })}
  </>
);
