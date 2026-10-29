/* ==========================================================================
   i18n: carga i18n/<lang>.json y traduce el DOM.

   Marcado:
     data-i18n="hero.title"                       → textContent
     data-i18n-attr="aria-label:nav.label;title:x" → atributos

   Otros módulos pueden usar t(key) y escuchar el evento "i18n:change".
   ========================================================================== */

export const LANGS = ['es', 'pt', 'en'];
const DEFAULT_LANG = 'es';
const STORAGE_KEY = 'lang';

const cache = new Map();
let current = DEFAULT_LANG;
let dict = {};

function lookup(source, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), source);
}

export function t(key) {
  const value = lookup(dict, key);
  return typeof value === 'string' ? value : key;
}

export function getLang() {
  return current;
}

async function load(lang) {
  if (!cache.has(lang)) {
    const res = await fetch(`i18n/${lang}.json`);
    if (!res.ok) throw new Error(`i18n: no se pudo cargar ${lang} (${res.status})`);
    cache.set(lang, await res.json());
  }
  return cache.get(lang);
}

export function translate(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = lookup(dict, el.dataset.i18n);
    if (typeof value === 'string') el.textContent = value;
  });

  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      const value = lookup(dict, key);
      if (attr && typeof value === 'string') el.setAttribute(attr, value);
    });
  });
}

function syncSwitch() {
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === current));
  });
}

export async function setLang(lang) {
  if (!LANGS.includes(lang)) lang = DEFAULT_LANG;
  try {
    dict = await load(lang);
  } catch (err) {
    console.error(err);
    return;
  }
  current = lang;
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* modo privado */ }
  translate();
  syncSwitch();
  document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
}

function detect() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;

  let stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* modo privado */ }
  if (LANGS.includes(stored)) return stored;

  const browser = (navigator.languages || [navigator.language])
    .map((l) => (l || '').slice(0, 2).toLowerCase())
    .find((l) => LANGS.includes(l));
  return browser || DEFAULT_LANG;
}

export function initI18n() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (btn) setLang(btn.dataset.lang);
  });
  return setLang(detect());
}
