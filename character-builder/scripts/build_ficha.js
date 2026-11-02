// Monta public/fichas.html: um único arquivo com CSS, SRD (PT-BR), motor de regras e a interface.
// Uso: node character-builder/scripts/build_ficha.js  (a partir da raiz do projeto)
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..", "..");
const dir = path.join(root, "character-builder", "ficha");
const safe = (s) =>
  s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

const regras = esbuild.buildSync({
  entryPoints: [path.join(dir, "entry.ts")],
  bundle: true,
  format: "iife",
  globalName: "Regras",
  target: "es2018",
  minify: true,
  write: false,
}).outputFiles[0].text;

const srd = JSON.stringify(
  JSON.parse(fs.readFileSync(path.join(root, "public", "srd52.json"), "utf8"))
);
const html = fs
  .readFileSync(path.join(dir, "template.html"), "utf8")
  .replace("/*CSS*/", () =>
    fs.readFileSync(path.join(dir, "ficha.css"), "utf8")
  )
  .replace("/*SRD*/", () => safe(srd))
  .replace("/*REGRAS*/", () => safe(regras))
  .replace("/*FICHA*/", () =>
    safe(fs.readFileSync(path.join(dir, "ficha.js"), "utf8"))
  );

const out = path.join(root, "public", "fichas.html");
fs.writeFileSync(out, html);
console.log(
  `${path.relative(root, out)}: ${(html.length / 1024).toFixed(0)} KB`
);
