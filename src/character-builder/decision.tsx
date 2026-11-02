import * as React from "react";
import {
  ABILITY_LABEL,
  ABILITY_SHORT,
  SCHOOL_LABEL,
  SIZE_LABEL,
  Srd,
  traitLabel,
} from "./srd";
import { abilityScores, Character, Decision, isDecisionDone } from "./rules";
import { Chip, Choice, color, Details, display, Html, Muted } from "./theme";

const docSubtitle = (srd: Srd, id: string) => {
  const d = srd.docs[id];
  if (!d) return "";
  if (d.type === "spell")
    return `${d.level ? `${d.level}º círculo` : "Truque"}, ${
      SCHOOL_LABEL[d.school ?? ""] ?? ""
    }`;
  return "";
};

/** Uma decisão pendente (perícias, talento, linhagem, aumento de atributo, subclasse, tamanho). */
export const DecisionEditor = ({
  srd,
  character,
  decision,
  onChange,
}: {
  srd: Srd;
  character: Character;
  decision: Decision;
  onChange: (c: Character) => void;
}) => {
  const done = isDecisionDone(decision);
  const heading = (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        margin: "22px 0 6px",
      }}
    >
      <span
        aria-label={done ? "Concluído" : "Pendente"}
        style={{
          width: 10,
          height: 10,
          borderRadius: 10,
          flex: "none",
          background: done ? color.gold : "transparent",
          border: `1px solid ${done ? color.gold : color.inkSoft}`,
          transition: "background .3s",
        }}
      />
      <h3
        style={{
          fontFamily: display,
          fontWeight: "normal",
          fontSize: 21,
          margin: 0,
        }}
      >
        {decision.title}
      </h3>
      <Muted style={{ fontSize: 14 }}>{decision.source.name}</Muted>
    </div>
  );

  if (decision.kind === "pick") {
    const chosen = decision.chosen;
    const limit = Math.min(decision.count, decision.options.length);
    const toggle = (value: string) => {
      let next = chosen.includes(value)
        ? chosen.filter((v) => v !== value)
        : limit === 1
        ? [value]
        : chosen.length < limit
        ? [...chosen, value]
        : chosen;
      onChange({
        ...character,
        choices: { ...character.choices, [decision.key]: next },
      });
    };
    return (
      <section>
        {heading}
        {decision.hint ? <Html html={decision.hint} /> : null}
        <Muted style={{ fontSize: 14 }}>
          {limit === 1
            ? "Escolha 1."
            : `Escolha ${limit}: ${chosen.length} de ${limit}.`}
        </Muted>
        <div style={{ marginTop: 10 }}>
          {decision.optionKind === "trait" ? (
            decision.options
              .map((o) => [o, traitLabel(srd, o)] as const)
              .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
              .map(([o, label]) => (
                <Chip
                  key={o}
                  selected={chosen.includes(o)}
                  onClick={() => toggle(o)}
                  aria-pressed={chosen.includes(o)}
                >
                  {label}
                </Chip>
              ))
          ) : (
            <OptionGrid
              srd={srd}
              ids={decision.options}
              chosen={chosen}
              onToggle={toggle}
            />
          )}
        </div>
      </section>
    );
  }

  if (decision.kind === "asi") {
    const current = character.asi[decision.key] ?? {};
    const scores = abilityScores(srd, character);
    const spent = Object.values(current).reduce((s, v) => s + (v ?? 0), 0);
    const feat = (character.choices[decision.key] ?? [])[0];
    const setInc = (ab: keyof typeof ABILITY_LABEL, delta: number) => {
      const value = (current[ab] ?? 0) + delta;
      if (value < 0 || value > decision.cap) return;
      if (delta > 0 && (spent >= decision.points || scores[ab] + delta > 20))
        return;
      const next = { ...current, [ab]: value };
      if (!value) delete next[ab];
      onChange({
        ...character,
        asi: { ...character.asi, [decision.key]: next },
        choices: { ...character.choices, [decision.key]: [] },
      });
    };
    return (
      <section>
        {heading}
        <Muted style={{ fontSize: 14, display: "block", marginBottom: 10 }}>
          {decision.background
            ? "Some +2 em um atributo e +1 em outro, ou +1 em três. Nenhum passa de 20."
            : "Some +2 em um atributo ou +1 em dois, sem passar de 20, ou escolha um talento."}
        </Muted>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 8,
          }}
        >
          {decision.allowed.map((ab) => (
            <div
              key={ab}
              style={{
                border: `1px solid ${current[ab] ? color.gold : color.rule}`,
                borderRadius: 10,
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              <span>
                <strong style={{ fontWeight: 600 }}>{ABILITY_SHORT[ab]}</strong>{" "}
                <Muted>{scores[ab]}</Muted>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Chip
                  style={{ margin: 0, minWidth: 40 }}
                  onClick={() => setInc(ab, -1)}
                  aria-label={`Tirar 1 de ${ABILITY_LABEL[ab]}`}
                >
                  −
                </Chip>
                <span
                  style={{
                    minWidth: 22,
                    textAlign: "center",
                    color: color.gold,
                  }}
                >
                  {current[ab] ? `+${current[ab]}` : ""}
                </span>
                <Chip
                  style={{ margin: 0, minWidth: 40 }}
                  onClick={() => setInc(ab, 1)}
                  aria-label={`Somar 1 em ${ABILITY_LABEL[ab]}`}
                >
                  +
                </Chip>
              </span>
            </div>
          ))}
        </div>
        {decision.featOptions.length ? (
          <>
            <p style={{ margin: "14px 0 8px", color: color.inkSoft }}>
              Ou troque o aumento por um talento:
            </p>
            {decision.featOptions.map((id) => (
              <DocChoice
                key={id}
                srd={srd}
                id={id}
                selected={feat === id}
                onSelect={() =>
                  onChange({
                    ...character,
                    choices: {
                      ...character.choices,
                      [decision.key]: feat === id ? [] : [id],
                    },
                    asi: { ...character.asi, [decision.key]: {} },
                  })
                }
              />
            ))}
          </>
        ) : null}
      </section>
    );
  }

  if (decision.kind === "subclass") {
    const entry = character.classes[decision.classIndex];
    return (
      <section>
        {heading}
        {decision.options.map((id) => (
          <DocChoice
            key={id}
            srd={srd}
            id={id}
            selected={entry.subclassId === id}
            onSelect={() =>
              onChange({
                ...character,
                classes: character.classes.map((e, i) =>
                  i === decision.classIndex ? { ...e, subclassId: id } : e
                ),
              })
            }
          />
        ))}
      </section>
    );
  }

  // tamanho
  const chosenSize = (character.choices[decision.key] ?? [])[0];
  return (
    <section>
      {heading}
      {decision.hint ? <Html html={decision.hint} /> : null}
      {decision.options.map((s) => (
        <Chip
          key={s}
          selected={chosenSize === s}
          onClick={() =>
            onChange({
              ...character,
              choices: { ...character.choices, [decision.key]: [s] },
            })
          }
        >
          {SIZE_LABEL[s] ?? s}
        </Chip>
      ))}
    </section>
  );
};

/** Opção que é um documento do SRD: nome, subtítulo e descrição recolhível. */
export const DocChoice = ({
  srd,
  id,
  selected,
  onSelect,
  subtitle,
}: {
  srd: Srd;
  id: string;
  selected: boolean;
  onSelect: () => void;
  subtitle?: string;
}) => {
  const doc = srd.docs[id];
  const [open, setOpen] = React.useState(false);
  if (!doc) return null;
  return (
    <div
      style={{
        border: `1px solid ${selected ? color.gold : color.rule}`,
        background: selected ? color.goldSoft : color.vellum,
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <Choice
          selected={false}
          onClick={onSelect}
          aria-pressed={selected}
          style={{ border: 0, background: "transparent", margin: 0, flex: 1 }}
        >
          <span style={{ fontSize: 17 }}>{doc.name}</span>
          {subtitle ? (
            <Muted style={{ display: "block", fontSize: 14 }}>{subtitle}</Muted>
          ) : null}
        </Choice>
        {doc.description ? (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={
              open
                ? `Fechar descrição de ${doc.name}`
                : `Ler descrição de ${doc.name}`
            }
            style={{
              font: "inherit",
              background: "transparent",
              border: 0,
              borderLeft: `1px solid ${color.rule}`,
              color: color.gold,
              width: 52,
              cursor: "pointer",
              fontSize: 20,
            }}
          >
            {open ? "−" : "+"}
          </button>
        ) : null}
      </div>
      {open ? (
        <div style={{ padding: "0 14px 12px" }}>
          <Html html={doc.description} />
        </div>
      ) : null}
    </div>
  );
};

export { Details };

/** Opções que são documentos do SRD, em grade, com busca e filtro de círculo quando a lista é longa. */
export const OptionGrid = ({
  srd,
  ids,
  chosen,
  onToggle,
}: {
  srd: Srd;
  ids: string[];
  chosen: string[];
  onToggle: (id: string) => void;
}) => {
  const [query, setQuery] = React.useState("");
  const [level, setLevel] = React.useState<number | null>(null);
  const spells =
    ids.length > 0 && ids.every((id) => srd.docs[id]?.type === "spell");
  const levels = spells
    ? [...new Set(ids.map((id) => srd.docs[id].level ?? 0))].sort(
        (a, b) => a - b
      )
    : [];
  const q = query.trim().toLowerCase();
  const shown = ids
    .filter((id) => srd.docs[id])
    .filter((id) => level === null || srd.docs[id].level === level)
    .filter(
      (id) =>
        !q ||
        `${srd.docs[id].name} ${srd.docs[id].nameEn ?? ""}`
          .toLowerCase()
          .includes(q)
    )
    .sort(
      (a, b) =>
        (srd.docs[a].level ?? 0) - (srd.docs[b].level ?? 0) ||
        srd.docs[a].name.localeCompare(srd.docs[b].name, "pt-BR")
    );
  return (
    <>
      {ids.length > 10 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            margin: "8px 0 12px",
          }}
        >
          <input
            type="search"
            placeholder="Buscar pelo nome"
            aria-label="Buscar opção pelo nome"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              font: "inherit",
              flex: "1 1 220px",
              minHeight: 42,
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${color.rule}`,
              background: color.vellum,
              color: color.ink,
            }}
          />
          {levels.length > 1 ? (
            <span style={{ display: "flex", flexWrap: "wrap" }}>
              <Chip
                selected={level === null}
                onClick={() => setLevel(null)}
                style={{ marginBottom: 0 }}
              >
                Todos
              </Chip>
              {levels.map((l) => (
                <Chip
                  key={l}
                  selected={level === l}
                  onClick={() => setLevel(l)}
                  style={{ marginBottom: 0 }}
                >
                  {l === 0 ? "Truques" : `${l}º`}
                </Chip>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      {chosen.length && ids.length > 10 ? (
        <p style={{ margin: "0 0 10px", color: color.inkSoft, fontSize: 15 }}>
          Escolhidas:{" "}
          <span style={{ color: color.gold }}>
            {chosen
              .map((id) => srd.docs[id]?.name)
              .filter(Boolean)
              .join(", ")}
          </span>
        </p>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
          gap: 8,
        }}
      >
        {shown.map((id) => (
          <DocChoice
            key={id}
            srd={srd}
            id={id}
            selected={chosen.includes(id)}
            onSelect={() => onToggle(id)}
            subtitle={docSubtitle(srd, id)}
          />
        ))}
      </div>
      {!shown.length ? <Muted>Nada com esse nome.</Muted> : null}
    </>
  );
};
