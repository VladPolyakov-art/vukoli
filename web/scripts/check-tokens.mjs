// Token guard: components must take colours from src/ds/tokens.css (CSS custom properties) only,
// so the stage-10 tokens can replace the provisional ones without touching components.
// Fails on hex / rgb() / hsl() colour literals in any .css / .tsx / .ts file except tokens.css,
// and on primitive variables (--color-gray-*, --color-blue-*, --elevation-* …) used outside tokens.css.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const allow = new Set(["ds/tokens.css"]);
const colour = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
// Primitive scales are emitted into tokens.css only so the semantic aliases resolve; components use semantic roles.
// --color-alpha-* is the generated name for the alpha primitives (--alpha-* is checked too, in case of a rename).
const primitive = /var\(\s*--(?:color-(?:gray|blue|red|amber|green|alpha)-|alpha-|elevation-)/;
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(css|tsx?)$/.test(name)) check(path);
  }
}

function check(path) {
  const rel = relative(root, path);
  if (allow.has(rel) || rel.endsWith(".test.ts")) return;
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    // Ignore comments and the "#" used in ids or URLs inside TS strings.
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (primitive.test(code)) problems.push(`${rel}:${i + 1}: primitive variable — use a semantic token (--color-canvas, --color-action, --shadow-raised…)`);
    if (/\.css$/.test(path) ? colour.test(code) : /["'`]#[0-9a-fA-F]{3,8}["'`]|rgba?\(|hsla?\(/.test(code)) {
      problems.push(`${rel}:${i + 1}: colour literal — use a token from src/ds/tokens.css`);
    }
  });
}

walk(root);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("check-tokens: ok (no colour literals outside src/ds/tokens.css, no primitive variables in components)");
