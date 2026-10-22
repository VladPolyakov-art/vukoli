// Undefined-variable guard: every var(--name) used in src/** (and .storybook) must be defined,
// either in src/ds/tokens.css or as a custom property declared locally (`--name:` in a CSS/TSX file).
// Local declarations with fallbacks `var(--x, fallback)` are still checked by name.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const web = new URL("..", import.meta.url).pathname;
const roots = [join(web, "src"), join(web, ".storybook")].filter(existsSync);
const defined = new Set();
const used = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(css|tsx?)$/.test(name)) scan(path);
  }
}

function scan(path) {
  const text = readFileSync(path, "utf8");
  for (const m of text.matchAll(/(^|[\s;{"'])(--[a-z0-9-]+)\s*:/g)) defined.add(m[2]);
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) used.push({ name: m[1], where: `${relative(web, path)}:${i + 1}` });
  });
}

roots.forEach(walk);
// Dynamic names such as var(--icon-${size}): the prefix must match at least one defined variable.
const known = (name) => (name.endsWith("-") ? [...defined].some((d) => d.startsWith(name)) : defined.has(name));
const missing = used.filter((u) => !known(u.name));
if (missing.length) {
  console.error(missing.map((u) => `${u.where}: ${u.name} is not defined in src/ds/tokens.css or locally`).join("\n"));
  process.exit(1);
}
console.log(`check-vars: ok (${new Set(used.map((u) => u.name)).size} distinct variables, all defined)`);
