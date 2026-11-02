import * as React from "react";
import styled from "@emotion/styled/macro";
import { css, Global } from "@emotion/react";
import { buildUrl } from "../public-url";

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
        background: ${color.night};
        color: ${color.ink};
        min-height: 100%;
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

export const Page = styled.main`
  max-width: 720px;
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
