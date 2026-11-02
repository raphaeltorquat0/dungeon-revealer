import * as React from "react";
import {
  ABILITIES,
  ABILITY_LABEL,
  ABILITY_SHORT,
  CONDITIONS,
  DAMAGE_LABEL,
  feetToMeters,
  MASTERY_LABEL,
  SCHOOL_LABEL,
  signed,
  SKILLS,
  Srd,
  traitLabel,
  WEAPON_PROPERTY_LABEL,
} from "./srd";
import {
  averageHitDie,
  canMulticlassInto,
  Character,
  decisions,
  dieFaces,
  grantedSpells,
  isDecisionDone,
  levelUp,
  longRest,
  sheet as computeSheet,
  shortRest,
  totalLevel,
} from "./rules";
import { DecisionEditor, DocChoice } from "./decision";
import {
  BottomBar,
  Button,
  Chip,
  color,
  Details,
  display,
  H2,
  Html,
  IlluminatedName,
  Input,
  Label,
  Lead,
  Muted,
  Page,
  TextArea,
} from "./theme";

const TABS = [
  ["resumo", "Resumo"],
  ["combate", "Combate"],
  ["magias", "Magias"],
  ["tracos", "Traços"],
  ["itens", "Itens"],
  ["notas", "Notas"],
] as const;
type Tab = typeof TABS[number][0];

export const classLine = (srd: Srd, c: Character) =>
  [
    c.speciesId ? srd.docs[c.speciesId]?.name : null,
    c.classes
      .map(
        (e) =>
          `${srd.docs[e.classId]?.name ?? "?"} ${e.level}${
            e.subclassId ? ` (${srd.docs[e.subclassId]?.name})` : ""
          }`
      )
      .join(" / "),
  ]
    .filter(Boolean)
    .join(", ");

const Stat = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) => (
  <div style={{ textAlign: "center", minWidth: 64 }}>
    <div
      style={{
        fontWeight: 600,
        fontSize: 28,
        lineHeight: 1.1,
        color: accent ?? color.ink,
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: 13, color: color.inkSoft }}>{label}</div>
  </div>
);

const Pips = ({
  total,
  spent,
  onChange,
  label,
}: {
  total: number;
  spent: number;
  onChange: (spent: number) => void;
  label: string;
}) => (
  <span
    role="group"
    aria-label={label}
    style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}
  >
    {Array.from({ length: total }, (_, i) => {
      const used = i < spent;
      return (
        <button
          key={i}
          aria-label={`${label}: ${used ? "recuperar" : "gastar"} 1`}
          onClick={() => onChange(used ? i : i + 1)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 30,
            cursor: "pointer",
            border: `1px solid ${color.gold}`,
            background: used ? "transparent" : color.gold,
            boxShadow: used ? "none" : "0 0 10px rgba(201,164,76,.35)",
          }}
        />
      );
    })}
  </span>
);

export const CharacterSheet = ({
  srd,
  character: c,
  onChange,
  onExit,
  onEditCreation,
  onDelete,
}: {
  srd: Srd;
  character: Character;
  onChange: (c: Character) => void;
  onExit: () => void;
  onEditCreation: () => void;
  onDelete: () => void;
}) => {
  const [tab, setTab] = React.useState<Tab>("resumo");
  const [levelingUp, setLevelingUp] = React.useState(false);
  const s = React.useMemo(() => computeSheet(srd, c), [srd, c]);
  const hp = Math.min(c.state.hp ?? s.maxHp, s.maxHp);
  const setState = (patch: Partial<Character["state"]>) =>
    onChange({ ...c, state: { ...c.state, ...patch } });
  const pending = decisions(srd, c).filter((d) => !isDecisionDone(d));

  if (levelingUp)
    return (
      <LevelUp
        srd={srd}
        character={c}
        onChange={onChange}
        onDone={() => setLevelingUp(false)}
      />
    );

  return (
    <Page>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <Button tone="quiet" onClick={onExit} style={{ minHeight: 40 }}>
          Fichas
        </Button>
        <Button
          tone="quiet"
          onClick={() => setLevelingUp(true)}
          style={{ minHeight: 40 }}
        >
          Subir de nível
        </Button>
      </div>
      <IlluminatedName name={c.name}>
        <Muted>
          {classLine(srd, c)}
          {c.player ? `. Jogador: ${c.player}` : ""}
        </Muted>
      </IlluminatedName>

      {pending.length ? (
        <button
          onClick={() => setLevelingUp(true)}
          style={{
            font: "inherit",
            marginTop: 14,
            width: "100%",
            textAlign: "left",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${color.gold}`,
            background: color.goldSoft,
            color: color.ink,
            cursor: "pointer",
          }}
        >
          {pending.length === 1
            ? "Falta 1 escolha"
            : `Faltam ${pending.length} escolhas`}{" "}
          nesta ficha. Toque para resolver.
        </button>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          margin: "20px 0 8px",
          flexWrap: "wrap",
        }}
      >
        <Stat label="CA" value={s.ac} />
        <Stat label="Iniciativa" value={signed(s.initiative)} />
        <Stat label="Deslocamento" value={feetToMeters(s.speed)} />
        <Stat label="Proficiência" value={signed(s.proficiencyBonus)} />
      </div>

      <HitPoints
        srd={srd}
        character={c}
        max={s.maxHp}
        hp={hp}
        setState={setState}
      />

      {tab === "resumo" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginTop: 18,
            }}
          >
            {ABILITIES.map((ab) => (
              <div
                key={ab}
                style={{
                  border: `1px solid ${color.rule}`,
                  borderRadius: 12,
                  padding: "8px 6px",
                  textAlign: "center",
                  background: color.vellum,
                }}
              >
                <div style={{ fontSize: 13, color: color.inkSoft }}>
                  {ABILITY_LABEL[ab]}
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>
                  {signed(s.modifiers[ab])}
                </div>
                <div style={{ fontSize: 14 }}>{s.scores[ab]}</div>
                <div
                  style={{
                    fontSize: 13,
                    color: s.saves[ab].proficient ? color.gold : color.inkSoft,
                  }}
                >
                  resistência {signed(s.saves[ab].bonus)}
                </div>
              </div>
            ))}
          </div>
          <H2>Perícias</H2>
          <div>
            {Object.entries(SKILLS)
              .sort((a, b) => a[1].label.localeCompare(b[1].label, "pt-BR"))
              .map(([key, info]) => {
                const sk = s.skills[key];
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "7px 0",
                      borderBottom: `1px solid ${color.rule}`,
                    }}
                  >
                    <span
                      style={{
                        color: sk.proficient ? color.ink : color.inkSoft,
                      }}
                    >
                      {sk.expertise ? "◆ " : sk.proficient ? "◇ " : "   "}
                      {info.label}{" "}
                      <Muted style={{ fontSize: 13 }}>
                        {ABILITY_SHORT[info.ability]}
                      </Muted>
                    </span>
                    <span
                      style={{ color: sk.proficient ? color.gold : color.ink }}
                    >
                      {signed(sk.bonus)}
                    </span>
                  </div>
                );
              })}
          </div>
          <p style={{ color: color.inkSoft }}>
            ◇ proficiente, ◆ especialização. Percepção passiva{" "}
            {s.passivePerception}
            {s.darkvision
              ? `. Visão no escuro ${feetToMeters(s.darkvision)}`
              : ""}
            .
          </p>
          <H2>Condições</H2>
          <div>
            {Object.entries(CONDITIONS).map(([key, label]) => {
              const on = c.state.conditions.includes(key);
              return (
                <Chip
                  key={key}
                  selected={on}
                  onClick={() =>
                    setState({
                      conditions: on
                        ? c.state.conditions.filter((x) => x !== key)
                        : [...c.state.conditions, key],
                    })
                  }
                >
                  {label}
                </Chip>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            <Chip
              selected={c.state.inspiration}
              onClick={() => setState({ inspiration: !c.state.inspiration })}
            >
              Inspiração Heroica
            </Chip>
            <span>
              Exaustão{" "}
              <Pips
                total={6}
                spent={6 - c.state.exhaustion}
                label="Exaustão"
                onChange={(spent) => setState({ exhaustion: 6 - spent })}
              />
            </span>
          </div>
          <H2>Proficiências</H2>
          <Lead style={{ color: color.ink }}>
            {[...s.traits]
              .filter((t) => /^(armor|weapon|tool|languages|dr):/.test(t))
              .map((t) => traitLabel(srd, t))
              .join(", ") || "Nenhuma"}
          </Lead>
        </>
      ) : null}

      {tab === "combate" ? (
        <>
          <H2>Ataques</H2>
          {s.attacks.map((a, i) => (
            <div
              key={i}
              style={{
                padding: "10px 0",
                borderBottom: `1px solid ${color.rule}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>{a.name}</span>
                <span>
                  <span style={{ color: color.gold }}>{signed(a.toHit)}</span>{" "}
                  <Muted>para acertar</Muted>
                </span>
              </div>
              <Muted style={{ fontSize: 14 }}>
                {a.damage} {DAMAGE_LABEL[a.damageType]?.toLowerCase() ?? ""}
                {a.range
                  ? `, distância ${a.range
                      .split("/")
                      .map((v) => feetToMeters(Number(v)))
                      .join("/")}`
                  : ""}
                {a.properties.length
                  ? `. ${a.properties
                      .map((p) => WEAPON_PROPERTY_LABEL[p] ?? p)
                      .join(", ")}`
                  : ""}
                {a.mastery
                  ? `. Maestria: ${MASTERY_LABEL[a.mastery] ?? a.mastery}`
                  : ""}
              </Muted>
            </div>
          ))}
          <Muted style={{ fontSize: 14, display: "block", marginTop: 8 }}>
            Armas aparecem aqui quando estão equipadas na aba Itens.
          </Muted>
          {s.scales.length ? (
            <>
              <H2>Recursos da classe</H2>
              {s.scales.map((sc) => {
                const key = sc.identifier;
                const trackable =
                  typeof sc.value === "number" &&
                  (sc.type === "usage" ||
                    /rages|points|focus|uses|channel/i.test(sc.title + key));
                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: `1px solid ${color.rule}`,
                    }}
                  >
                    <span>{sc.title}</span>
                    {trackable ? (
                      <Pips
                        total={Number(sc.value)}
                        spent={c.state.uses[key] ?? 0}
                        label={sc.title}
                        onChange={(spent) =>
                          setState({ uses: { ...c.state.uses, [key]: spent } })
                        }
                      />
                    ) : (
                      <span style={{ color: color.gold }}>
                        {sc.type === "distance"
                          ? `+${feetToMeters(Number(sc.value))}`
                          : String(sc.value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          ) : null}
          <H2>Dados de Vida</H2>
          {s.hitDice.map((h) => (
            <div
              key={h.classId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
              }}
            >
              <span>
                {srd.docs[h.classId]?.name} ({h.die})
              </span>
              <Pips
                total={h.count}
                spent={c.state.hitDiceSpent[h.classId] ?? 0}
                label={`Dados de Vida ${h.die}`}
                onChange={(spent) =>
                  setState({
                    hitDiceSpent: {
                      ...c.state.hitDiceSpent,
                      [h.classId]: spent,
                    },
                  })
                }
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Button style={{ flex: 1 }} onClick={() => onChange(shortRest(c))}>
              Descanso curto
            </Button>
            <Button
              style={{ flex: 1 }}
              onClick={() => onChange(longRest(srd, c))}
            >
              Descanso longo
            </Button>
          </div>
          <Muted style={{ fontSize: 14, display: "block", marginTop: 8 }}>
            O descanso longo recupera PV, Dados de Vida, espaços de magia e
            recursos. O curto recupera os espaços de pacto; gaste Dados de Vida
            acima e cure na barra de PV.
          </Muted>
        </>
      ) : null}

      {tab === "magias" ? (
        <SpellsTab srd={srd} character={c} sheet={s} onChange={onChange} />
      ) : null}

      {tab === "tracos" ? (
        <>
          <H2>Características e traços</H2>
          {s.features.map(({ doc, source }, i) => (
            <Details key={`${doc.id}-${i}`}>
              <summary>
                <span>
                  {doc.name}{" "}
                  <Muted style={{ fontSize: 14 }}>{source.name}</Muted>
                </span>
              </summary>
              <Html html={doc.description} />
            </Details>
          ))}
        </>
      ) : null}

      {tab === "itens" ? (
        <ItemsTab srd={srd} character={c} onChange={onChange} />
      ) : null}

      {tab === "notas" ? (
        <>
          <Label htmlFor="notas">Anotações da campanha</Label>
          <TextArea
            id="notas"
            style={{ minHeight: 220 }}
            value={c.details.notes ?? ""}
            onChange={(e) =>
              onChange({
                ...c,
                details: { ...c.details, notes: e.target.value },
              })
            }
          />
          <Label htmlFor="aparencia2">Aparência</Label>
          <TextArea
            id="aparencia2"
            value={c.details.appearance ?? ""}
            onChange={(e) =>
              onChange({
                ...c,
                details: { ...c.details, appearance: e.target.value },
              })
            }
          />
          <Label htmlFor="historia2">História</Label>
          <TextArea
            id="historia2"
            value={c.details.backstory ?? ""}
            onChange={(e) =>
              onChange({
                ...c,
                details: { ...c.details, backstory: e.target.value },
              })
            }
          />
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 24,
              flexWrap: "wrap",
            }}
          >
            <Button onClick={onEditCreation}>Rever criação</Button>
            <Button
              tone="danger"
              onClick={() => {
                if (
                  window.confirm(
                    `Excluir a ficha de ${
                      c.name || "personagem sem nome"
                    }? Não dá para desfazer.`
                  )
                )
                  onDelete();
              }}
            >
              Excluir ficha
            </Button>
          </div>
        </>
      ) : null}

      <BottomBar
        aria-label="Seções da ficha"
        style={{
          gap: 2,
          padding: "6px 4px calc(6px + env(safe-area-inset-bottom))",
        }}
      >
        {TABS.filter(
          ([id]) =>
            id !== "magias" ||
            s.spellcasting.length ||
            grantedSpells(srd, c).length
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              window.scrollTo({ top: 0 });
            }}
            aria-current={tab === id ? "page" : undefined}
            style={{
              font: "inherit",
              fontSize: 14,
              minHeight: 48,
              background: "transparent",
              border: 0,
              borderTop: `2px solid ${tab === id ? color.gold : "transparent"}`,
              color: tab === id ? color.ink : color.inkSoft,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </BottomBar>
    </Page>
  );
};

const HitPoints = ({
  character: c,
  max,
  hp,
  setState,
}: {
  srd: Srd;
  character: Character;
  max: number;
  hp: number;
  setState: (patch: Partial<Character["state"]>) => void;
}) => {
  const [amount, setAmount] = React.useState("");
  const n = Math.max(0, parseInt(amount, 10) || 0);
  const damage = () => {
    const fromTemp = Math.min(c.state.temp, n);
    setState({
      temp: c.state.temp - fromTemp,
      hp: Math.max(0, hp - (n - fromTemp)),
    });
    setAmount("");
  };
  const heal = () => {
    setState({
      hp: Math.min(max, hp + n),
      deathSaves: { success: 0, failure: 0 },
    });
    setAmount("");
  };
  const ratio = max ? hp / max : 0;
  return (
    <section
      aria-label="Pontos de Vida"
      style={{
        border: `1px solid ${color.rule}`,
        borderRadius: 14,
        padding: 14,
        background: color.vellum,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span>Pontos de Vida</span>
        <span>
          <span
            style={{
              fontWeight: 600,
              fontSize: 36,
              color: ratio <= 0.25 ? "#E7A0A9" : color.ink,
            }}
          >
            {hp}
          </span>
          <Muted> / {max}</Muted>
          {c.state.temp ? (
            <span style={{ color: color.verdigris }}>
              {" "}
              +{c.state.temp} temp.
            </span>
          ) : null}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 6,
          background: color.rule,
          margin: "8px 0 12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, ratio * 100)}%`,
            height: "100%",
            background: ratio <= 0.25 ? color.seal : color.verdigris,
            transition: "width .3s",
          }}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(64px, 84px) repeat(3, 1fr)",
          gap: 6,
        }}
      >
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Valor"
          aria-label="Quantidade de dano ou cura"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ minWidth: 0 }}
        />
        <Button
          tone="danger"
          style={{ padding: "10px 4px" }}
          disabled={!n}
          onClick={damage}
        >
          Dano
        </Button>
        <Button
          style={{ padding: "10px 4px", borderColor: color.verdigris }}
          disabled={!n}
          onClick={heal}
        >
          Cura
        </Button>
        <Button
          style={{ padding: "10px 4px" }}
          aria-label="Pontos de Vida temporários"
          disabled={!n}
          onClick={() => {
            setState({ temp: Math.max(c.state.temp, n) });
            setAmount("");
          }}
        >
          Temp.
        </Button>
      </div>
      {hp === 0 ? (
        <div
          style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}
        >
          <span>
            Sucessos{" "}
            <Pips
              total={3}
              spent={3 - c.state.deathSaves.success}
              label="Sucessos contra a morte"
              onChange={(sp) =>
                setState({
                  deathSaves: { ...c.state.deathSaves, success: 3 - sp },
                })
              }
            />
          </span>
          <span>
            Falhas{" "}
            <Pips
              total={3}
              spent={3 - c.state.deathSaves.failure}
              label="Falhas contra a morte"
              onChange={(sp) =>
                setState({
                  deathSaves: { ...c.state.deathSaves, failure: 3 - sp },
                })
              }
            />
          </span>
        </div>
      ) : null}
    </section>
  );
};

const SpellsTab = ({
  srd,
  character: c,
  sheet: s,
  onChange,
}: {
  srd: Srd;
  character: Character;
  sheet: ReturnType<typeof computeSheet>;
  onChange: (c: Character) => void;
}) => {
  const granted = grantedSpells(srd, c);
  const [editing, setEditing] = React.useState(false);
  const setSpent = (lvl: number, spent: number) =>
    onChange({
      ...c,
      state: {
        ...c.state,
        slotsSpent: { ...c.state.slotsSpent, [lvl]: spent },
      },
    });
  const listed = (ids: string[]) =>
    ids
      .filter((id) => srd.docs[id])
      .sort(
        (a, b) =>
          (srd.docs[a].level ?? 0) - (srd.docs[b].level ?? 0) ||
          srd.docs[a].name.localeCompare(srd.docs[b].name, "pt-BR")
      )
      .map((id) => {
        const d = srd.docs[id];
        return (
          <Details key={id}>
            <summary>
              <span>
                {d.name}{" "}
                <Muted style={{ fontSize: 14 }}>
                  {d.level ? `${d.level}º círculo` : "Truque"},{" "}
                  {SCHOOL_LABEL[d.school ?? ""]}
                  {d.properties?.includes("concentration")
                    ? ", concentração"
                    : ""}
                  {d.properties?.includes("ritual") ? ", ritual" : ""}
                </Muted>
              </span>
            </summary>
            <Html html={d.description} />
          </Details>
        );
      });
  if (editing)
    return (
      <>
        <Button onClick={() => setEditing(false)} style={{ marginTop: 16 }}>
          Concluir escolha de magias
        </Button>
        <SpellPicker srd={srd} character={c} onChange={onChange} />
      </>
    );
  return (
    <>
      {s.spellcasting.map((sc) => (
        <div
          key={sc.classId}
          style={{
            display: "flex",
            justifyContent: "space-around",
            margin: "18px 0 6px",
          }}
        >
          <Stat
            label={`CD de magia (${ABILITY_SHORT[sc.ability]})`}
            value={sc.dc}
            accent={color.verdigris}
          />
          <Stat
            label="Ataque de magia"
            value={signed(sc.attack)}
            accent={color.verdigris}
          />
        </div>
      ))}
      {s.slots.slots.length || s.slots.pact ? <H2>Espaços de magia</H2> : null}
      {s.slots.slots.map((count, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
          }}
        >
          <span>{i + 1}º círculo</span>
          <Pips
            total={count}
            spent={c.state.slotsSpent[i + 1] ?? 0}
            label={`Espaços de ${i + 1}º círculo`}
            onChange={(sp) => setSpent(i + 1, sp)}
          />
        </div>
      ))}
      {s.slots.pact ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
          }}
        >
          <span>Pacto ({s.slots.pact.level}º círculo)</span>
          <Pips
            total={s.slots.pact.count}
            spent={c.state.pactSpent}
            label="Espaços de pacto"
            onChange={(sp) =>
              onChange({ ...c, state: { ...c.state, pactSpent: sp } })
            }
          />
        </div>
      ) : null}
      <H2>Truques e magias preparadas</H2>
      {listed([...c.spells.known, ...c.spells.prepared])}
      {granted.length ? (
        <>
          <H2>Magias de talentos e traços</H2>
          <Muted style={{ fontSize: 14 }}>Sempre preparadas.</Muted>
          {listed(granted.map((g) => g.id))}
        </>
      ) : null}
      <Button style={{ marginTop: 14 }} onClick={() => setEditing(true)}>
        Trocar magias preparadas
      </Button>
    </>
  );
};

const SpellPicker = ({
  srd,
  character: c,
  onChange,
}: {
  srd: Srd;
  character: Character;
  onChange: (c: Character) => void;
}) => {
  const s = computeSheet(srd, c);
  return (
    <>
      {s.spellcasting.map((l) => {
        const cantripIds = l.list.filter((id) => srd.docs[id]?.level === 0);
        const spellIds = l.list.filter(
          (id) =>
            (srd.docs[id]?.level ?? 0) >= 1 &&
            (srd.docs[id]?.level ?? 0) <= l.maxLevel
        );
        const chosenC = c.spells.known.filter((id) => cantripIds.includes(id));
        const chosenP = c.spells.prepared.filter((id) => spellIds.includes(id));
        const toggle = (
          field: "known" | "prepared",
          id: string,
          limit: number,
          current: string[]
        ) => {
          const list = c.spells[field];
          onChange({
            ...c,
            spells: {
              ...c.spells,
              [field]: list.includes(id)
                ? list.filter((x) => x !== id)
                : current.length < limit
                ? [...list, id]
                : list,
            },
          });
        };
        return (
          <section key={l.classId}>
            <H2>{srd.docs[l.classId].name}</H2>
            {l.cantrips ? (
              <Lead>
                Truques: {chosenC.length} de {l.cantrips}
              </Lead>
            ) : null}
            {cantripIds.map((id) => (
              <DocChoice
                key={id}
                srd={srd}
                id={id}
                subtitle="Truque"
                selected={chosenC.includes(id)}
                onSelect={() => toggle("known", id, l.cantrips, chosenC)}
              />
            ))}
            <Lead>
              Preparadas: {chosenP.length} de {l.prepared}, até o {l.maxLevel}º
              círculo
            </Lead>
            {spellIds.map((id) => (
              <DocChoice
                key={id}
                srd={srd}
                id={id}
                subtitle={`${srd.docs[id].level}º círculo`}
                selected={chosenP.includes(id)}
                onSelect={() => toggle("prepared", id, l.prepared, chosenP)}
              />
            ))}
          </section>
        );
      })}
    </>
  );
};

const ItemsTab = ({
  srd,
  character: c,
  onChange,
}: {
  srd: Srd;
  character: Character;
  onChange: (c: Character) => void;
}) => {
  const [query, setQuery] = React.useState("");
  const results =
    query.trim().length >= 2
      ? Object.values(srd.docs)
          .filter(
            (d) =>
              d.pack === "equipment24" &&
              d.name.toLowerCase().includes(query.trim().toLowerCase())
          )
          .slice(0, 12)
      : [];
  const setItems = (inventory: Character["inventory"]) =>
    onChange({ ...c, inventory });
  return (
    <>
      <H2>Moedas</H2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 6,
        }}
      >
        {(["pp", "gp", "ep", "sp", "cp"] as const).map((k) => (
          <label
            key={k}
            style={{ textAlign: "center", fontSize: 13, color: color.inkSoft }}
          >
            {{ pp: "PL", gp: "PO", ep: "PE", sp: "PP", cp: "PC" }[k]}
            <Input
              type="number"
              inputMode="numeric"
              value={c.currency[k]}
              onChange={(e) =>
                onChange({
                  ...c,
                  currency: { ...c.currency, [k]: Number(e.target.value) || 0 },
                })
              }
              style={{ textAlign: "center", padding: "8px 4px" }}
            />
          </label>
        ))}
      </div>
      <H2>Inventário</H2>
      {c.inventory.map((item) => {
        const doc = item.itemId ? srd.docs[item.itemId] : undefined;
        const equipable = doc && (doc.type === "weapon" || doc.armor);
        return (
          <div
            key={item.uid}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom: `1px solid ${color.rule}`,
            }}
          >
            <span style={{ flex: 1 }}>
              {doc?.name ?? item.name}
              {item.quantity > 1 ? <Muted> × {item.quantity}</Muted> : null}
            </span>
            {equipable ? (
              <Chip
                selected={item.equipped}
                style={{ margin: 0 }}
                onClick={() =>
                  setItems(
                    c.inventory.map((i) =>
                      i.uid === item.uid ? { ...i, equipped: !i.equipped } : i
                    )
                  )
                }
              >
                {item.equipped ? "Equipado" : "Equipar"}
              </Chip>
            ) : null}
            <Chip
              style={{ margin: 0, minWidth: 40 }}
              aria-label={`Remover um ${doc?.name ?? item.name}`}
              onClick={() =>
                setItems(
                  item.quantity > 1
                    ? c.inventory.map((i) =>
                        i.uid === item.uid
                          ? { ...i, quantity: i.quantity - 1 }
                          : i
                      )
                    : c.inventory.filter((i) => i.uid !== item.uid)
                )
              }
            >
              −
            </Chip>
          </div>
        );
      })}
      <Label htmlFor="busca-item">Adicionar item</Label>
      <Input
        id="busca-item"
        placeholder="Busque pelo nome, ex.: corda"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.map((d) => (
        <Chip
          key={d.id}
          onClick={() => {
            setItems([
              ...c.inventory,
              { uid: `${d.id}-${Date.now()}`, itemId: d.id, quantity: 1 },
            ]);
            setQuery("");
          }}
        >
          {d.name}
        </Chip>
      ))}
    </>
  );
};

const LevelUp = ({
  srd,
  character: c,
  onChange,
  onDone,
}: {
  srd: Srd;
  character: Character;
  onChange: (c: Character) => void;
  onDone: () => void;
}) => {
  const [classId, setClassId] = React.useState<string | null>(null);
  const [lastClassId, setLastClassId] = React.useState<string | null>(null);
  const [roll, setRoll] = React.useState<number | null>(null);
  const [applied, setApplied] = React.useState(
    totalLevel(c) >= 20 || decisions(srd, c).some((d) => !isDecisionDone(d))
  );
  // o que falta, mais as escolhas que surgem no nível que acabou de subir (para conferir)
  const lastClass =
    c.classes.find((e) => e.classId === lastClassId) ??
    c.classes[c.classes.length - 1];
  const pending = decisions(srd, c).filter(
    (d) =>
      !isDecisionDone(d) ||
      (d.classIndex !== null &&
        c.classes[d.classIndex] === lastClass &&
        d.advLevel === lastClass?.level)
  );

  if (!applied) {
    const classes = Object.values(srd.docs)
      .filter((d) => d.type === "class")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const faces = classId ? dieFaces(srd.docs[classId].hitDie) : 0;
    return (
      <Page>
        <H2 style={{ marginTop: 0 }}>Subir para o nível {totalLevel(c) + 1}</H2>
        <Lead>
          Escolha em que classe ganhar o nível. Multiclasse exige 13 no atributo
          principal das duas classes.
        </Lead>
        {classes.map((cls) => {
          const current = c.classes.find((e) => e.classId === cls.id);
          const allowed = canMulticlassInto(srd, c, cls.id);
          return (
            <DocChoice
              key={cls.id}
              srd={srd}
              id={cls.id}
              selected={classId === cls.id}
              subtitle={
                current
                  ? `Nível ${current.level} → ${current.level + 1}`
                  : allowed
                  ? "Nova classe (multiclasse)"
                  : "Requisito de atributo não atendido"
              }
              onSelect={() => (allowed ? setClassId(cls.id) : undefined)}
            />
          );
        })}
        {classId ? (
          <>
            <H2>Pontos de Vida</H2>
            <Lead>
              Use a média ({averageHitDie(srd, classId)}) ou role{" "}
              {srd.docs[classId].hitDie}. A Constituição soma depois.
            </Lead>
            <div>
              <Chip selected={roll === null} onClick={() => setRoll(null)}>
                Média: {averageHitDie(srd, classId)}
              </Chip>
              <Chip
                selected={roll !== null}
                onClick={() => setRoll(1 + Math.floor(Math.random() * faces))}
              >
                {roll !== null
                  ? `Rolei ${roll}. Rolar de novo`
                  : `Rolar ${srd.docs[classId].hitDie}`}
              </Chip>
            </div>
          </>
        ) : null}
        <BottomBar>
          <Button onClick={onDone}>Cancelar</Button>
          <Button
            tone="primary"
            disabled={!classId}
            onClick={() => {
              const next = levelUp(
                srd,
                c,
                classId!,
                roll ?? averageHitDie(srd, classId!)
              );
              const s = computeSheet(srd, next);
              onChange({
                ...next,
                state: {
                  ...next.state,
                  hp: Math.min(
                    s.maxHp,
                    (c.state.hp ?? 0) + (s.maxHp - computeSheet(srd, c).maxHp)
                  ),
                },
              });
              setLastClassId(classId);
              setApplied(true);
            }}
          >
            Subir de nível
          </Button>
        </BottomBar>
      </Page>
    );
  }

  return (
    <Page>
      <H2 style={{ marginTop: 0 }}>Escolhas do nível {totalLevel(c)}</H2>
      {pending.length ? (
        pending.map((d) => (
          <DecisionEditor
            key={d.key}
            srd={srd}
            character={c}
            decision={d}
            onChange={onChange}
          />
        ))
      ) : (
        <Lead>
          Nenhuma escolha neste nível. As novas características já estão na aba
          Traços.
        </Lead>
      )}
      {computeSheet(srd, c).spellcasting.some(
        (l) =>
          c.spells.prepared.filter((id) => l.list.includes(id)).length <
            l.prepared ||
          c.spells.known.filter(
            (id) => l.list.includes(id) && srd.docs[id]?.level === 0
          ).length < l.cantrips
      ) ? (
        <>
          <H2>Novas magias</H2>
          <Lead>
            Este nível libera mais magias. Escolha agora ou depois, na aba
            Magias.
          </Lead>
          <SpellPicker srd={srd} character={c} onChange={onChange} />
        </>
      ) : null}
      <BottomBar>
        <Button
          tone="primary"
          disabled={decisions(srd, c).some((d) => !isDecisionDone(d))}
          onClick={onDone}
        >
          Voltar à ficha
        </Button>
      </BottomBar>
    </Page>
  );
};
