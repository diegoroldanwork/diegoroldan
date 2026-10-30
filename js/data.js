/* ==========================================================================
   Datos de data/*.json, compartidos por las secciones y por el chat.
   Los campos traducibles son { es, pt, en }; pick() devuelve el del idioma
   actual (o el valor tal cual si no es traducible).
   ========================================================================== */

import { getLang } from './i18n.js';

const cache = new Map();

export function loadData(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`data/${name}.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`data/${name}.json: ${res.status}`))))
      .catch((err) => { console.error(err); return {}; }));
  }
  return cache.get(name);
}

export function pick(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'es' in value) {
    return value[getLang()] ?? value.es;
  }
  return value;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function tagList(items) {
  const list = el('ul', 'tags');
  items.forEach((item) => list.append(el('li', null, pick(item))));
  return list;
}

const LOCALES = { es: 'es-AR', pt: 'pt-BR', en: 'en-US' };

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALES[getLang()], { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(y, m - 1, d));
}
