/* ==========================================================================
   Build de Netlify (y antes de probar en local):
     node netlify/build-knowledge.mjs

   Junta data/*.json, i18n/*.json y data/claudia-conocimiento.md en
   netlify/lib/knowledge.generated.mjs (no se versiona). Así la función usa
   exactamente los mismos datos que el sitio, sin copiarlos a mano.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const data = {
  projects: json('data/projects.json'),
  stack: json('data/stack.json'),
  education: json('data/education.json'),
  contact: json('data/contact.json'),
  i18n: { es: json('i18n/es.json'), pt: json('i18n/pt.json'), en: json('i18n/en.json') },
};

// El .md: se quitan las notas de revisión (líneas "> …") y se separa la
// sección "Lo que Claudia NO responde", que va al prompt como reglas.
const RULES_HEADING = /^## Lo que Claudia NO responde\s*$/m;
const md = read('data/claudia-conocimiento.md')
  .split(/\r?\n/)
  .filter((line) => !line.startsWith('>'))
  .join('\n');

const match = md.match(RULES_HEADING);
if (!match) throw new Error('claudia-conocimiento.md: falta la sección "## Lo que Claudia NO responde"');
const rulesStart = match.index + match[0].length;
const nextHeading = md.slice(rulesStart).search(/^## /m);
const rulesEnd = nextHeading === -1 ? md.length : rulesStart + nextHeading;

const rules = md.slice(rulesStart, rulesEnd).trim();
const notes = (md.slice(0, match.index) + md.slice(rulesEnd)).replace(/\n{3,}/g, '\n\n').trim();

if (/\[[^\]]+\]/.test(notes + rules)) {
  console.warn('claudia-conocimiento.md: quedan textos entre [corchetes] sin completar');
}

const out = path.join(root, 'netlify/lib/knowledge.generated.mjs');
fs.writeFileSync(out, `// Generado por netlify/build-knowledge.mjs — no editar a mano.
export const DATA = ${JSON.stringify(data)};
export const NOTES = ${JSON.stringify(notes)};
export const RULES = ${JSON.stringify(rules)};
`);
console.log(`knowledge: ${path.relative(root, out)} (${notes.length} + ${rules.length} caracteres del .md)`);
