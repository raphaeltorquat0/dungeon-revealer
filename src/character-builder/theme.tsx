import * as React from "react";
import styled from "@emotion/styled/macro";
import { css, Global } from "@emotion/react";
import { buildUrl } from "../public-url";
import { ICONS } from "./icons";

// Ficha iluminada à luz de vela: tinta índigo-noite, velino, ouro velho só no que é seu e no foco.
export const color = {
  night: "#17151F",
  vellum: "#221F2C",
  vellumHi: "#2C2838",
  rule: "#3A3548",
  ink: "#E9E1CF",
  inkSoft: "#A79F8E",
  gold: "#C9A44C",
  goldSoft: "rgba(201, 164, 76, 0.16)",
  seal: "#9E2B3A",
  verdigris: "#4E8C7A",
};

const serif = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Noto Serif", serif`;
export const display = `"Goudy Mediaeval", ${serif}`;

export const GlobalStyle = () => (
  <Global
    styles={css`
      @font-face {
        font-family: "Goudy Mediaeval";
        src: url("${buildUrl("/fonts/Goudy Mediaeval Regular.woff")}")
          format("woff");
        font-display: swap;
      }
      html,
      body,
      #root {
        color: ${color.ink};
        min-height: 100%;
      }
      body {
        /* luz de vela vinda de cima, cantos escuros e grão de papel bem leve */
        background: radial-gradient(
              ellipse 80% 50% at 50% -10%,
              rgba(201, 164, 76, 0.13),
              transparent 70%
            )
            fixed,
          radial-gradient(
              ellipse at 50% 120%,
              rgba(0, 0, 0, 0.55),
              transparent 60%
            )
            fixed,
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.9 0 0 0 0 0.85 0 0 0 0 0.75 0 0 0 .035 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
          ${color.night};
      }
      body {
        font-family: ${serif};
        font-size: 17px;
        line-height: 1.55;
        font-variant-numeric: lining-nums tabular-nums;
        -webkit-font-smoothing: antialiased;
        -webkit-tap-highlight-color: transparent;
      }
      :focus-visible {
        outline: 2px solid ${color.gold};
        outline-offset: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
          animation: none !important;
        }
      }
    `}
  />
);

export const Page = styled.main<{ wide?: boolean }>`
  max-width: ${(p) => (p.wide ? "1240px" : "720px")};
  margin: 0 auto;
  padding: 20px 18px calc(96px + env(safe-area-inset-bottom));
`;

export const H1 = styled.h1`
  font-family: ${display};
  font-weight: normal;
  font-size: 34px;
  line-height: 1.1;
  margin: 8px 0 4px;
  color: ${color.ink};
`;

export const H2 = styled.h2`
  font-family: ${display};
  font-weight: normal;
  font-size: 24px;
  line-height: 1.2;
  margin: 28px 0 10px;
  color: ${color.ink};
`;

export const Lead = styled.p`
  color: ${color.inkSoft};
  margin: 0 0 16px;
  max-width: 62ch;
`;

export const Rule = styled.hr`
  border: 0;
  border-top: 1px solid ${color.rule};
  margin: 20px 0;
`;

/** A inicial iluminada do nome: o único gesto ousado da interface. */
export const IlluminatedName = ({
  name,
  size = 64,
  children,
}: {
  name: string;
  size?: number;
  children?: React.ReactNode;
}) => {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <span
        aria-hidden
        style={{
          fontFamily: display,
          fontSize: size,
          lineHeight: 0.9,
          color: color.gold,
          textShadow: `0 0 18px rgba(201,164,76,.35)`,
          minWidth: size * 0.62,
          textAlign: "center",
        }}
      >
        {initial}
      </span>
      <div style={{ minWidth: 0, paddingTop: size * 0.08 }}>
        <div
          style={{
            fontFamily: display,
            fontSize: size * 0.45,
            lineHeight: 1.15,
            overflowWrap: "anywhere",
          }}
        >
          {name.trim() || "Sem nome"}
        </div>
        {children}
      </div>
    </div>
  );
};

const buttonBase = css`
  font: inherit;
  font-size: 16px;
  min-height: 48px;
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

export const Button = styled.button<{ tone?: "primary" | "quiet" | "danger" }>`
  ${buttonBase};
  border: 1px solid
    ${(p) =>
      p.tone === "primary"
        ? color.gold
        : p.tone === "danger"
        ? color.seal
        : color.rule};
  background: ${(p) =>
    p.tone === "primary"
      ? color.gold
      : p.tone === "danger"
      ? "transparent"
      : color.vellum};
  color: ${(p) =>
    p.tone === "primary"
      ? color.night
      : p.tone === "danger"
      ? "#E7A0A9"
      : color.ink};
  font-weight: ${(p) => (p.tone === "primary" ? 600 : 400)};
`;

/** Opção selecionável (perícia, talento, magia...). Selecionada = moldura de ouro. */
export const Choice = styled.button<{ selected?: boolean }>`
  ${buttonBase};
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid ${(p) => (p.selected ? color.gold : color.rule)};
  background: ${(p) => (p.selected ? color.goldSoft : color.vellum)};
  color: ${color.ink};
  margin: 0 0 8px;
  padding: 12px 14px;
`;

export const Chip = styled.button<{ selected?: boolean }>`
  ${buttonBase};
  min-height: 40px;
  padding: 6px 12px;
  margin: 0 6px 8px 0;
  border: 1px solid ${(p) => (p.selected ? color.gold : color.rule)};
  background: ${(p) => (p.selected ? color.goldSoft : "transparent")};
  color: ${(p) => (p.selected ? color.ink : color.inkSoft)};
`;

export const Input = styled.input`
  font: inherit;
  width: 100%;
  min-height: 48px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${color.rule};
  background: ${color.vellum};
  color: ${color.ink};
  &::placeholder {
    color: ${color.inkSoft};
  }
`;

export const TextArea = styled.textarea`
  font: inherit;
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${color.rule};
  background: ${color.vellum};
  color: ${color.ink};
`;

export const Label = styled.label`
  display: block;
  color: ${color.inkSoft};
  font-size: 15px;
  margin: 14px 0 6px;
`;

/** Barra fixa no rodapé, ao alcance do polegar. */
export const BottomBar = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(23, 21, 31, 0.94);
  backdrop-filter: blur(8px);
  border-top: 1px solid ${color.rule};
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  display: flex;
  gap: 10px;
  justify-content: center;
  z-index: 10;
  & > * {
    flex: 1;
    max-width: 340px;
  }
`;

/** Texto de regras vindo do SRD (estático, gerado no build). */
export const RulesText = styled.div`
  color: ${color.ink};
  font-size: 16px;
  line-height: 1.6;
  max-width: 68ch;
  overflow-wrap: anywhere;
  p {
    margin: 0 0 10px;
  }
  h2,
  h3,
  h4 {
    font-family: ${display};
    font-weight: normal;
    margin: 16px 0 6px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 14px;
    margin: 8px 0 14px;
    display: block;
    overflow-x: auto;
  }
  th,
  td {
    border-bottom: 1px solid ${color.rule};
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  ul {
    padding-left: 20px;
  }
  aside {
    border-left: 2px solid ${color.rule};
    padding-left: 12px;
    color: ${color.inkSoft};
  }
`;

export const Html = ({ html }: { html?: string }) =>
  html ? <RulesText dangerouslySetInnerHTML={{ __html: html }} /> : null;

/** Bloco recolhível para descrições longas. */
export const Details = styled.details`
  border-top: 1px solid ${color.rule};
  padding: 10px 0;
  summary {
    cursor: pointer;
    list-style: none;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::after {
    content: "+";
    color: ${color.gold};
    font-size: 20px;
  }
  &[open] summary::after {
    content: "−";
  }
`;

export const Muted = styled.span`
  color: ${color.inkSoft};
`;

/** Ícone do game-icons.net (CC BY 3.0) colorido pelo texto. */
export const Glyph = ({
  name,
  size = 40,
  title,
}: {
  name: string;
  size?: number;
  title?: string;
}) => {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden={!title}
      role={title ? "img" : undefined}
      style={{ display: "block", flex: "none" }}
    >
      {title ? <title>{title}</title> : null}
      <path d={d} fill="currentColor" />
    </svg>
  );
};

/** Medalhão: o ícone sobre um disco escuro com aro de ouro. */
export const Medallion = ({
  name,
  size = 64,
  lit,
}: {
  name: string;
  size?: number;
  lit?: boolean;
}) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: size,
      flex: "none",
      display: "grid",
      placeItems: "center",
      color: lit ? color.gold : "#B9A77A",
      background: `radial-gradient(circle at 50% 35%, ${color.vellumHi}, ${color.night})`,
      border: `1px solid ${lit ? color.gold : color.rule}`,
      boxShadow: lit
        ? "0 0 22px rgba(201,164,76,.35), inset 0 0 12px rgba(201,164,76,.15)"
        : "inset 0 0 10px rgba(0,0,0,.6)",
      transition: "box-shadow .25s, border-color .25s, color .25s",
    }}
  >
    <Glyph name={name} size={Math.round(size * 0.58)} />
  </span>
);

/** Filete de ouro com um losango no meio, para abrir seções. */
export const Ornament = () => (
  <div
    aria-hidden
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      margin: "6px 0 18px",
      color: color.gold,
    }}
  >
    <span
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${color.gold} 60%)`,
        opacity: 0.5,
      }}
    />
    <span
      style={{
        width: 7,
        height: 7,
        transform: "rotate(45deg)",
        border: `1px solid ${color.gold}`,
      }}
    />
    <span
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(270deg, transparent, ${color.gold} 60%)`,
        opacity: 0.5,
      }}
    />
  </div>
);

export const useWide = (min = 980) => {
  const query = `(min-width: ${min}px)`;
  const [wide, setWide] = React.useState(
    () => window.matchMedia(query).matches
  );
  React.useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return wide;
};

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid ${color.rule};
  color: ${color.inkSoft};
  line-height: 1.35;
`;
