import * as React from "react";
import styled from "@emotion/styled/macro";
import { BACKGROUND_LORE, CLASS_LORE, PLAYSTYLES, SPECIES_LORE } from "./lore";
import {
  ABILITIES,
  ABILITY_LABEL,
  ABILITY_SHORT,
  AbilityKey,
  feetToMeters,
  Srd,
  SrdDoc,
  signed,
  traitLabel,
} from "./srd";
import {
  Character,
  Root,
  STANDARD_ARRAY,
  abilityScores,
  averageHitDie,
  decisions,
  isDecisionDone,
  levelUp,
  modifier,
  pointBuySpent,
  sheet,
  spellLimits,
} from "./rules";
import { DecisionEditor, DocChoice, OptionGrid } from "./decision";
import { classLine } from "./sheet";
import {
  categoryItems,
  describeNode,
  EquipmentNode,
  equipmentTree,
  pendingEquipment,
  resolveEquipment,
} from "./equipment";
import {
  Badge,
  Button,
  Chip,
  color,
  Details,
  display,
  H1,
  H2,
  Html,
  IlluminatedName,
  Input,
  Label,
  Lead,
  Medallion,
  Muted,
  Ornament,
  Page,
  TextArea,
  useWide,
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
  const wide = useWide(980);
  const [stepIndex, setStepIndex] = React.useState(() =>
    character.classes.length ? 1 : 0
  );
  const c = character;
  const hasClass = c.classes.length > 0;
  const [playstyle, setPlaystyle] = React.useState<string | null>(null);
  const startLevel = c.classes[0]?.level ?? 1;
  const setStartLevel = (level: number) => {
    const entry = c.classes[0];
    if (!entry || level < 1 || level > 20) return;
    // criar já em qualquer nível: PV pela média; as escolhas dos níveis aparecem em "Escolhas da classe"
    const avg = averageHitDie(srd, entry.classId);
    onChange({
      ...c,
      classes: [
        {
          ...entry,
          level,
          hitPoints: Array.from(
            { length: level - 1 },
            (_, i) => entry.hitPoints[i] ?? avg
          ),
        },
      ],
    });
  };
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

  const choicesFor = (root: Root) => {
    const list = decisions(srd, c).filter((d) => d.root === root);
    if (!list.length) return null;
    const editor = (d: typeof list[number]) => (
      <DecisionEditor
        key={d.key}
        srd={srd}
        character={c}
        decision={d}
        onChange={onChange}
      />
    );
    if (root !== "class" || startLevel === 1)
      return (
        <Panel>
          <H2 style={{ marginTop: 0 }}>Suas escolhas</H2>
          {list.map(editor)}
        </Panel>
      );
    const levels = [...new Set(list.map((d) => Math.max(1, d.advLevel)))].sort(
      (x, y) => x - y
    );
    return (
      <>
        {levels.map((lvl) => (
          <Panel key={lvl}>
            <H2 style={{ marginTop: 0 }}>Nível {lvl}</H2>
            {list.filter((d) => Math.max(1, d.advLevel) === lvl).map(editor)}
          </Panel>
        ))}
      </>
    );
  };

  const selectClass = (id: string) => {
    if (c.classes[0]?.classId === id) return;
    // trocar de classe recomeça as escolhas da classe e o equipamento
    const base = {
      ...c,
      classes: [],
      equipmentChoice: {},
      inventory: [],
      spells: { known: [], prepared: [] },
    };
    const next = levelUp(srd, base, id, 0);
    onChange(
      abilitiesValid(next)
        ? next
        : {
            ...next,
            abilityMethod: "standard",
            abilities: suggested(srd.docs[id].primaryAbility?.value ?? []),
          }
    );
  };

  const steps: Step[] = [
    {
      id: "classe",
      title: "Classe",
      done: () => hasClass,
      render: () => (
        <>
          {hasClass ? (
            <Panel
              style={{
                marginTop: 0,
                marginBottom: 18,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Medallion
                name={srd.docs[c.classes[0].classId].identifier ?? ""}
                size={44}
                lit
              />
              <span style={{ flex: "1 1 200px" }}>
                <span style={{ fontFamily: display, fontSize: 22 }}>
                  Nível inicial
                </span>
                <Muted style={{ display: "block", fontSize: 14 }}>
                  Comece no nível que a campanha pede. As escolhas de cada nível
                  aparecem em "Escolhas da classe".
                </Muted>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Chip
                  style={{ margin: 0, minWidth: 44 }}
                  aria-label="Diminuir nível inicial"
                  onClick={() => setStartLevel(startLevel - 1)}
                >
                  −
                </Chip>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    minWidth: 40,
                    textAlign: "center",
                  }}
                >
                  {startLevel}
                </span>
                <Chip
                  style={{ margin: 0, minWidth: 44 }}
                  aria-label="Aumentar nível inicial"
                  onClick={() => setStartLevel(startLevel + 1)}
                >
                  +
                </Chip>
              </span>
            </Panel>
          ) : null}
          <Chooser
            wide={wide}
            srd={srd}
            lead="A classe define o que o personagem faz em combate, que magia usa e como cresce."
            items={docsOfType("class")}
            selectedId={c.classes[0]?.classId}
            onSelect={selectClass}
            icon={(d) => d.identifier ?? ""}
            dim={(d) =>
              Boolean(playstyle) &&
              !PLAYSTYLES[playstyle!].includes(d.identifier ?? "")
            }
            extra={
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0 4px",
                  margin: "0 0 14px",
                }}
              >
                <Muted style={{ marginRight: 8 }}>Como você quer jogar?</Muted>
                {Object.keys(PLAYSTYLES).map((k) => (
                  <Chip
                    key={k}
                    selected={playstyle === k}
                    aria-pressed={playstyle === k}
                    onClick={() => setPlaystyle(playstyle === k ? null : k)}
                  >
                    {k}
                  </Chip>
                ))}
              </div>
            }
            tagline={(d) => CLASS_LORE[d.identifier ?? ""]?.tagline}
            meta={(d) => [
              `Dado de Vida ${d.hitDie}`,
              (d.primaryAbility?.value ?? [])
                .map((ab) => ABILITY_SHORT[ab])
                .join(d.primaryAbility?.all ? " e " : " ou "),
              CLASS_LORE[d.identifier ?? ""]?.role,
            ]}
          />
        </>
      ),
    },
    {
      id: "antecedente",
      title: "Antecedente",
      done: () => Boolean(c.backgroundId) && rootDone(srd, c, "background"),
      render: () => (
        <>
          <Chooser
            wide={wide}
            srd={srd}
            lead="De onde o personagem vem. Dá aumentos de atributo, perícias, uma ferramenta e um talento de origem."
            items={docsOfType("background")}
            selectedId={c.backgroundId}
            onSelect={(id) => onChange({ ...c, backgroundId: id })}
            icon={(d) => d.identifier ?? ""}
            tagline={(d) => BACKGROUND_LORE[d.identifier ?? ""]}
            meta={(d) => grantsOf(srd, d)}
          />
          {c.backgroundId ? choicesFor("background") : null}
        </>
      ),
    },
    {
      id: "especie",
      title: "Espécie",
      done: () => Boolean(c.speciesId) && rootDone(srd, c, "species"),
      render: () => (
        <>
          <Chooser
            wide={wide}
            srd={srd}
            lead="A espécie define tamanho, deslocamento e traços como visão no escuro ou resistências."
            items={docsOfType("race")}
            selectedId={c.speciesId}
            onSelect={(id) => onChange({ ...c, speciesId: id })}
            icon={(d) => d.identifier ?? ""}
            tagline={(d) => SPECIES_LORE[d.identifier ?? ""]}
            meta={(d) => [
              `Deslocamento ${feetToMeters(Number(d.movement?.walk ?? 30))}`,
              d.senses?.darkvision
                ? `Visão no escuro ${feetToMeters(d.senses.darkvision)}`
                : undefined,
            ]}
          />
          {c.speciesId ? choicesFor("species") : null}
        </>
      ),
    },
    {
      id: "atributos",
      title: "Atributos",
      done: () => hasClass && abilitiesValid(c),
      render: () => <AbilityStep srd={srd} character={c} onChange={onChange} />,
    },
    {
      id: "escolhas",
      title: "Escolhas da classe",
      done: () => hasClass && rootDone(srd, c, "class"),
      render: () =>
        !hasClass ? (
          <Lead>Escolha a classe primeiro.</Lead>
        ) : (
          choicesFor("class") ?? (
            <Lead>Esta classe não pede outras escolhas no 1º nível.</Lead>
          )
        ),
    },
    {
      id: "equipamento",
      title: "Equipamento",
      done: () =>
        hasClass && Boolean(c.backgroundId) && equipmentPending.length === 0,
      render: () => (
        <>
          <Lead>
            Fique com o kit pronto (A) ou leve o valor em ouro (B) e compre o
            que quiser.
          </Lead>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
              gap: 16,
            }}
          >
            {(
              [
                [
                  "Da classe",
                  classEquipment,
                  c.classes[0] ? srd.docs[c.classes[0].classId] : undefined,
                ],
                [
                  "Do antecedente",
                  backgroundEquipment,
                  c.backgroundId ? srd.docs[c.backgroundId] : undefined,
                ],
              ] as const
            ).map(([label, roots, doc]) => (
              <Panel key={label}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  {doc ? (
                    <Medallion name={doc.identifier ?? ""} size={44} lit />
                  ) : null}
                  <div>
                    <H2 style={{ margin: 0 }}>{label}</H2>
                    <Muted style={{ fontSize: 14 }}>
                      {doc?.name ?? "Escolha antes no passo anterior"}
                    </Muted>
                  </div>
                </div>
                {roots.map((n) => (
                  <EquipmentNodeEditor
                    key={n.id}
                    srd={srd}
                    node={n}
                    choice={equipmentChoice}
                    onChoice={applyEquipment}
                  />
                ))}
              </Panel>
            ))}
          </div>
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
            columnGap: 20,
          }}
        >
          <div>
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
          </div>
          <div>
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
          </div>
        </div>
      ),
    },
    {
      id: "revisao",
      title: "Revisão",
      done: () => steps.slice(0, -1).every((x) => x.done(c)),
      render: () => (
        <Review
          srd={srd}
          character={c}
          wide={wide}
          pending={steps.slice(0, -1).map((x, i) => ({
            title: x.title,
            done: x.done(c),
            go: () => go(i),
          }))}
        />
      ),
    },
  ];

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const allDone = steps.every((s) => s.done(c));
  const go = (i: number) => {
    setStepIndex(i);
    window.scrollTo({ top: 0 });
  };

  const stepButton = (s: Step, i: number, compact: boolean) => {
    const current = i === stepIndex;
    const done = s.done(c);
    return (
      <li key={s.id} style={{ flex: "none" }}>
        <button
          onClick={() => go(i)}
          aria-current={current ? "step" : undefined}
          style={{
            font: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: compact ? undefined : "100%",
            padding: compact ? "6px 12px 6px 6px" : "8px 10px",
            borderRadius: 30,
            cursor: "pointer",
            textAlign: "left",
            color: current ? color.ink : done ? color.ink : color.inkSoft,
            background: current ? color.goldSoft : "transparent",
            border: `1px solid ${current ? color.gold : "transparent"}`,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 28,
              flex: "none",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              fontWeight: 600,
              border: `1px solid ${done || current ? color.gold : color.rule}`,
              background: done ? color.gold : "transparent",
              color: done ? color.night : color.ink,
            }}
          >
            {done ? "✓" : i + 1}
          </span>
          <span style={{ fontSize: 16 }}>{s.title}</span>
        </button>
      </li>
    );
  };

  const nav = (
    <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
      <Button
        disabled={stepIndex === 0}
        onClick={() => go(stepIndex - 1)}
        style={{ flex: 1 }}
      >
        Anterior
      </Button>
      {stepIndex < steps.length - 1 ? (
        <Button
          tone="primary"
          disabled={!step.done(c)}
          onClick={() => go(stepIndex + 1)}
          style={{ flex: 2 }}
        >
          Próximo: {steps[stepIndex + 1].title}
        </Button>
      ) : (
        <Button
          tone="primary"
          style={{ flex: 2 }}
          disabled={!allDone}
          onClick={() => {
            onChange({ ...c, state: { ...c.state, hp: sheet(srd, c).maxHp } });
            onFinish();
          }}
        >
          Concluir ficha
        </Button>
      )}
    </div>
  );

  return (
    <Page wide>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <Button tone="quiet" onClick={onExit} style={{ minHeight: 40 }}>
          Voltar às fichas
        </Button>
        <Muted style={{ fontSize: 14 }}>Tudo é salvo automaticamente</Muted>
      </div>
      <div
        style={{
          display: wide ? "grid" : "block",
          gridTemplateColumns: "250px minmax(0, 1fr)",
          gap: 36,
          alignItems: "start",
        }}
      >
        {wide ? (
          <aside style={{ position: "sticky", top: 20 }}>
            <ol
              aria-label="Passos"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 4,
              }}
            >
              {steps.map((s, i) => stepButton(s, i, false))}
            </ol>
            <Summary srd={srd} character={c} />
          </aside>
        ) : (
          <ol
            aria-label="Passos"
            style={{
              display: "flex",
              gap: 6,
              listStyle: "none",
              padding: "0 0 6px",
              margin: "0 -18px 8px",
              paddingLeft: 18,
              overflowX: "auto",
            }}
          >
            {steps.map((s, i) => stepButton(s, i, true))}
          </ol>
        )}
        <div>
          <Muted style={{ fontSize: 15 }}>
            Passo {stepIndex + 1} de {steps.length}
          </Muted>
          <H1 style={{ fontSize: wide ? 44 : 34 }}>{step.title}</H1>
          <Ornament />
          {step.render()}
          {nav}
        </div>
      </div>
    </Page>
  );
};

/** Galeria de cartões com detalhes da opção escolhida ao lado (desktop) ou abaixo (celular). */
const Chooser = ({
  wide,
  srd,
  lead,
  items,
  selectedId,
  onSelect,
  icon,
  tagline,
  meta,
  dim,
  extra,
}: {
  wide: boolean;
  srd: Srd;
  lead: string;
  items: SrdDoc[];
  selectedId?: string;
  onSelect: (id: string) => void;
  icon: (d: SrdDoc) => string;
  tagline: (d: SrdDoc) => string | undefined;
  meta: (d: SrdDoc) => (string | undefined)[];
  dim?: (d: SrdDoc) => boolean;
  extra?: React.ReactNode;
}) => {
  const selected = selectedId ? srd.docs[selectedId] : undefined;
  const detail = selected ? (
    <Detail
      srd={srd}
      doc={selected}
      icon={icon(selected)}
      tagline={tagline(selected)}
    />
  ) : null;
  const showSide = wide && window.innerWidth >= 1240 && Boolean(selected);
  return (
    <>
      <Lead>{lead}</Lead>
      {extra}
      <div
        style={{
          display: showSide ? "grid" : "block",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: wide
              ? "repeat(auto-fill, minmax(220px, 1fr))"
              : "1fr",
            gap: 12,
          }}
        >
          {items.map((d) => {
            const sel = d.id === selectedId;
            return (
              <CardButton
                key={d.id}
                row={!wide}
                selected={sel}
                aria-pressed={sel}
                onClick={() => onSelect(d.id)}
                style={{ opacity: dim?.(d) && !sel ? 0.38 : 1 }}
              >
                <Medallion name={icon(d)} size={wide ? 60 : 52} lit={sel} />
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontFamily: display,
                      fontSize: wide ? 25 : 23,
                      lineHeight: 1.1,
                    }}
                  >
                    {d.name}
                  </span>
                  {tagline(d) ? (
                    <span
                      style={{
                        color: color.inkSoft,
                        fontSize: 15,
                        lineHeight: 1.4,
                      }}
                    >
                      {tagline(d)}
                    </span>
                  ) : null}
                  <span
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: "auto",
                    }}
                  >
                    {meta(d)
                      .filter(Boolean)
                      .map((m) => (
                        <Badge key={m}>{m}</Badge>
                      ))}
                  </span>
                </span>
              </CardButton>
            );
          })}
        </div>
        {showSide ? (
          <div
            style={{
              position: "sticky",
              top: 20,
              maxHeight: "calc(100vh - 40px)",
              overflowY: "auto",
              borderRadius: 16,
            }}
          >
            {detail}
          </div>
        ) : detail ? (
          <div style={{ marginTop: 20 }}>{detail}</div>
        ) : null}
      </div>
    </>
  );
};

const CardButton = styled.button<{ selected?: boolean; row?: boolean }>`
  font: inherit;
  color: ${color.ink};
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: ${(p) => (p.row ? "row" : "column")};
  align-items: ${(p) => (p.row ? "flex-start" : "stretch")};
  gap: ${(p) => (p.row ? "14px" : "10px")};
  min-height: ${(p) => (p.row ? "0" : "176px")};
  padding: 16px;
  border-radius: 16px;
  border: 1px solid ${(p) => (p.selected ? color.gold : color.rule)};
  background: ${(p) =>
    p.selected
      ? `linear-gradient(180deg, rgba(201,164,76,.14), ${color.vellum})`
      : `linear-gradient(180deg, ${color.vellumHi}, ${color.vellum})`};
  box-shadow: ${(p) =>
    p.selected
      ? "0 0 0 1px rgba(201,164,76,.35), 0 10px 30px rgba(0,0,0,.35)"
      : "0 6px 18px rgba(0,0,0,.25)"};
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  &:hover {
    border-color: ${(p) => (p.selected ? color.gold : "rgba(201,164,76,.5)")};
    transform: translateY(-2px);
  }
`;

const Panel = styled.section`
  border: 1px solid ${color.rule};
  border-radius: 16px;
  padding: 18px;
  margin-top: 20px;
  background: linear-gradient(
    180deg,
    rgba(44, 40, 56, 0.6),
    rgba(34, 31, 44, 0.6)
  );
`;

/** O que a opção escolhida concede, lido do próprio SRD. */
const Detail = ({
  srd,
  doc,
  icon,
  tagline,
}: {
  srd: Srd;
  doc: SrdDoc;
  icon: string;
  tagline?: string;
}) => {
  const html = doc.description ?? "";
  // o primeiro quadro do texto da classe é o resumo dos traços principais
  const table = html.match(/<table[\s\S]*?<\/table>/)?.[0];
  const features = (doc.advancement ?? [])
    .filter((a) => a.type === "ItemGrant" && (a.level ?? 0) <= 1)
    .flatMap((a) => (a.config.items ?? []) as string[])
    .map((id) => srd.docs[id])
    .filter(Boolean);
  return (
    <Panel style={{ marginTop: 0 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Medallion name={icon} size={76} lit />
        <div>
          <div style={{ fontFamily: display, fontSize: 30, lineHeight: 1.1 }}>
            {doc.name}
          </div>
          {tagline ? <Muted>{tagline}</Muted> : null}
        </div>
      </div>
      {table ? <Html html={table} /> : null}
      {features.length ? (
        <>
          <div
            style={{ fontFamily: display, fontSize: 20, margin: "14px 0 6px" }}
          >
            {doc.type === "class" ? "No 1º nível" : "Traços"}
          </div>
          {features.map((f) => (
            <Details key={f.id}>
              <summary>{f.name}</summary>
              <Html html={f.description} />
            </Details>
          ))}
        </>
      ) : null}
      <Details>
        <summary>{table ? "Texto completo" : "Descrição"}</summary>
        <Html html={table ? html.replace(table, "") : html} />
      </Details>
    </Panel>
  );
};

/** Antecedente: perícias e talento concedidos, como selos curtos. */
const grantsOf = (srd: Srd, d: SrdDoc) =>
  (d.advancement ?? []).flatMap((a) => {
    if (a.type === "Trait")
      return (a.config.grants ?? [])
        .filter((g: string) => g.startsWith("skills:"))
        .map((g: string) => traitLabel(srd, g));
    if (a.type === "ItemGrant")
      return (a.config.items ?? []).map((id: string) => srd.docs[id]?.name);
    return [];
  });

/** Prévia do personagem durante a criação. */
const Summary = ({ srd, character: c }: { srd: Srd; character: Character }) => {
  const scores = abilityScores(srd, c);
  const cls = c.classes[0] ? srd.docs[c.classes[0].classId] : undefined;
  const lines = [
    cls,
    c.speciesId ? srd.docs[c.speciesId] : undefined,
    c.backgroundId ? srd.docs[c.backgroundId] : undefined,
  ];
  return (
    <Panel style={{ marginTop: 22 }}>
      <IlluminatedName name={c.name || "Seu personagem"} size={46} />
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {lines.map((d, i) =>
          d ? (
            <div
              key={d.id}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <Medallion name={d.identifier ?? ""} size={30} lit />
              <span>{d.name}</span>
            </div>
          ) : (
            <Muted key={i} style={{ fontSize: 14, paddingLeft: 40 }}>
              {["Classe", "Espécie", "Antecedente"][i]} a escolher
            </Muted>
          )
        )}
      </div>
      {cls ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            marginTop: 14,
          }}
        >
          {ABILITIES.map((ab) => (
            <div
              key={ab}
              style={{
                textAlign: "center",
                padding: "4px 0",
                borderRadius: 8,
                border: `1px solid ${color.rule}`,
              }}
            >
              <div style={{ fontSize: 12, color: color.inkSoft }}>
                {ABILITY_SHORT[ab]}
              </div>
              <div style={{ fontWeight: 600 }}>{scores[ab]}</div>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
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
        <Label
          as="div"
          style={{ color: choice[node.id] ? color.inkSoft : color.gold }}
        >
          {choice[node.id] ? "" : "Falta escolher: "}
          {describeNode(srd, node)}
        </Label>
        {options.map((d) => (
          <Chip
            aria-pressed={choice[node.id] === d.id}
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
                <OptionGrid
                  srd={srd}
                  ids={cantripIds}
                  chosen={chosenCantrips}
                  onToggle={(id) =>
                    toggle("known", id, l.cantrips, chosenCantrips)
                  }
                />
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
                <OptionGrid
                  srd={srd}
                  ids={spellIds}
                  chosen={chosenPrepared}
                  onToggle={(id) =>
                    toggle("prepared", id, l.prepared, chosenPrepared)
                  }
                />
              </div>
            </>
          ) : null}
        </section>
      );
    })}
  </>
);

/** Revisão final: os números calculados e o que ainda falta, com atalho para cada passo. */
const Review = ({
  srd,
  character: c,
  wide,
  pending,
}: {
  srd: Srd;
  character: Character;
  wide: boolean;
  pending: { title: string; done: boolean; go: () => void }[];
}) => {
  const s = sheet(srd, c);
  const missing = pending.filter((p) => !p.done);
  const skills = Object.entries(s.skills)
    .filter(([, v]) => v.proficient)
    .map(
      ([k, v]) =>
        `${traitLabel(srd, `skills:${k}`)} ${signed(v.bonus)}${
          v.expertise ? " (especialização)" : ""
        }`
    );
  const other = [...s.traits]
    .filter((t) => /^(armor|weapon|tool|languages|dr):/.test(t))
    .map((t) => traitLabel(srd, t));
  const spells = [...c.spells.known, ...c.spells.prepared]
    .map((id) => srd.docs[id]?.name)
    .filter(Boolean);
  const items = c.inventory
    .map((i) => (i.itemId ? srd.docs[i.itemId]?.name : i.name))
    .filter(Boolean);
  const stat = (label: string, value: React.ReactNode) => (
    <div style={{ textAlign: "center", minWidth: 80 }}>
      <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: color.inkSoft }}>{label}</div>
    </div>
  );
  const block = (title: string, body: React.ReactNode) => (
    <Panel style={{ marginTop: 0 }}>
      <div style={{ fontFamily: display, fontSize: 21, marginBottom: 6 }}>
        {title}
      </div>
      {body}
    </Panel>
  );
  return (
    <>
      {missing.length ? (
        <Panel
          style={{ marginTop: 0, marginBottom: 16, borderColor: color.gold }}
        >
          <div style={{ fontFamily: display, fontSize: 21, color: color.gold }}>
            Falta pouco
          </div>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
          >
            {missing.map((m) => (
              <Button key={m.title} onClick={m.go} style={{ minHeight: 40 }}>
                Resolver: {m.title}
              </Button>
            ))}
          </div>
        </Panel>
      ) : null}
      <Panel style={{ marginTop: 0 }}>
        <IlluminatedName name={c.name || "Sem nome"} size={wide ? 72 : 56}>
          <Muted>{classLine(srd, c)}</Muted>
        </IlluminatedName>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-around",
            gap: 12,
            marginTop: 18,
          }}
        >
          {stat("CA", s.ac)}
          {stat("Pontos de Vida", s.maxHp)}
          {stat("Iniciativa", signed(s.initiative))}
          {stat("Deslocamento", feetToMeters(s.speed))}
          {stat("Proficiência", signed(s.proficiencyBonus))}
          {stat("Percepção passiva", s.passivePerception)}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 6,
            marginTop: 18,
          }}
        >
          {ABILITIES.map((ab) => (
            <div
              key={ab}
              style={{
                textAlign: "center",
                border: `1px solid ${color.rule}`,
                borderRadius: 10,
                padding: "6px 2px",
              }}
            >
              <div style={{ fontSize: 12, color: color.inkSoft }}>
                {ABILITY_SHORT[ab]}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {signed(s.modifiers[ab])}
              </div>
              <div style={{ fontSize: 13 }}>{s.scores[ab]}</div>
            </div>
          ))}
        </div>
      </Panel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        {block("Perícias", <Muted>{skills.join(", ") || "Nenhuma"}</Muted>)}
        {block(
          "Proficiências e idiomas",
          <Muted>{other.join(", ") || "Nenhuma"}</Muted>
        )}
        {block(
          "Ataques",
          s.attacks.map((a) => (
            <div
              key={a.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: "3px 0",
              }}
            >
              <span>{a.name}</span>
              <Muted>
                {signed(a.toHit)}, {a.damage}
              </Muted>
            </div>
          ))
        )}
        {block("Magias", <Muted>{spells.join(", ") || "Nenhuma"}</Muted>)}
        {block(
          "Equipamento",
          <Muted>
            {items.join(", ") || "Nada"}
            {c.currency.gp ? `. ${c.currency.gp} PO` : ""}
          </Muted>
        )}
        {block(
          "Características",
          <Muted>{s.features.map((f) => f.doc.name).join(", ")}</Muted>
        )}
      </div>
    </>
  );
};
