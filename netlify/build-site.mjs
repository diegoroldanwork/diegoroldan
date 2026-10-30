/* ==========================================================================
   Build de Netlify, paso 2: arma dist/ sólo con lo público.
     node netlify/build-site.mjs

   Lista explícita en vez de publicar la raíz: data/claudia-conocimiento.md y
   netlify/ no llegan a dist/, así que no se pueden pedir de ninguna forma
   (las reglas de redirección distinguen mayúsculas y el hosting no).
   La función los sigue usando: se empaqueta desde el repo, no desde dist/.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const PUBLIC = ['index.html', '_headers', 'css', 'js', 'i18n', 'img', 'docs', 'data'];
const PRIVATE = new Set(['data/claudia-conocimiento.md']);

fs.rmSync(dist, { recursive: true, force: true });
for (const entry of PUBLIC) {
  fs.cpSync(path.join(root, entry), path.join(dist, entry), {
    recursive: true,
    filter: (src) => !PRIVATE.has(path.relative(root, src).split(path.sep).join('/')),
  });
}

for (const p of PRIVATE) {
  if (fs.existsSync(path.join(dist, p))) throw new Error(`build-site: ${p} no debería estar en dist/`);
}
console.log(`site: dist/ (${PUBLIC.join(', ')}) sin ${[...PRIVATE].join(', ')}`);
