/* ==========================================================================
   Chat con Claudia: preguntas rápidas con respuestas fijas (i18n + data/) y
   texto libre respondido por IA vía /api/chat (netlify/functions/chat.mjs).

   El historial se guarda como claves cuando puede: al cambiar de idioma se
   vuelve a dibujar en el idioma nuevo (las respuestas de la IA quedan tal cual).
   ========================================================================== */

import { t, tr, getLang } from './i18n.js';
import { loadData, pick, el } from './data.js';
import { stackGroups, certMeta } from './sections.js';

// false = el texto libre responde con el aviso de "próximamente"
const CHAT_FREE_TEXT = true;
const ENDPOINT = '/api/chat';
const TIMEOUT_MS = 20000;
const MAX_FREE_PER_SESSION = 5;
const MAX_HISTORY = 6;           // mensajes de texto libre que se mandan como contexto
const COUNT_KEY = 'claudia:count';

// Sección a la que lleva el link "Ver…" de cada respuesta
const SECTION = { about: 'sobre-mi', projects: 'proyectos', stack: 'stack', certs: 'formacion' };

const TYPING_MS = 650;

const history = [{ from: 'bot', kind: 'greeting' }];
let data = { projects: [], groups: [], certs: [], contact: {} };
let pending = null;
let waiting = false;   // esperando a la IA
let els = {};

// "Soy **Diego**" → Soy <strong>Diego</strong>; cada línea, un párrafo
function rich(text) {
  const frag = document.createDocumentFragment();
  text.split(/\n+/).filter((line) => line.trim()).forEach((line) => {
    const p = el('p');
    line.split(/\*\*([^*]+)\*\*/).forEach((part, i) => {
      p.append(i % 2 ? el('strong', null, part) : document.createTextNode(part));
    });
    frag.append(p);
  });
  return frag;
}

function contactLinks() {
  const c = data.contact;
  return [
    c.email && { label: 'Email', href: `mailto:${c.email}` },
    c.linkedin && { label: 'LinkedIn', href: c.linkedin, external: true },
    c.github && { label: 'GitHub', href: c.github, external: true },
    c.whatsapp && { label: 'WhatsApp', href: c.whatsapp, external: true },
  ].filter(Boolean);
}

function cards(items) {
  const list = el('ul', 'chat__cards');
  items.forEach(({ title, desc }) => {
    const li = el('li', 'chat__card');
    li.append(el('strong', null, title), el('span', null, desc));
    list.append(li);
  });
  return list;
}

function linkRow(links) {
  const row = el('div', 'chat__links');
  links.forEach(({ label, href, external }) => {
    const a = el('a', 'btn btn--sm', label);
    a.href = href;
    if (external) {
      a.target = '_blank';
      a.rel = 'noopener';
      a.append(el('span', 'sr-only', ` ${t('a11y.newTab')}`));
    }
    row.append(a);
  });
  return row;
}

function answer(id) {
  const parts = [rich(t(`chat.answers.${id}.text`))];

  if (id === 'projects') {
    parts.push(cards(data.projects.map((p) => ({ title: pick(p.title), desc: pick(p.short) }))));
  } else if (id === 'stack') {
    parts.push(stackGroups(data.groups, 'chat-stack'));
  } else if (id === 'certs') {
    parts.push(cards(data.certs.filter((c) => c.featured).map((c) => ({ title: c.name, desc: certMeta(c) }))));
  }

  if (id === 'contact') parts.push(linkRow(contactLinks()));
  else if (SECTION[id]) parts.push(linkRow([{ label: t(`chat.answers.${id}.more`), href: `#${SECTION[id]}` }]));
  return parts;
}

function bubble(msg) {
  const node = el('div', `chat__msg chat__msg--${msg.from}`);
  if (msg.from === 'user') {
    node.textContent = msg.text ?? t(`chat.answers.${msg.id}.q`);
  } else if (msg.kind === 'greeting') {
    node.append(rich(t('chat.greeting')));
  } else if (msg.kind === 'soon') {
    node.append(rich(t('chat.soon')));
  } else if (msg.kind === 'ai') {
    node.append(rich(msg.text));
  } else if (msg.kind === 'error') {
    // busy | unavailable | limit — siempre con salida por email
    node.append(rich(t(`chat.errors.${msg.key}`)), linkRow(contactLinks().slice(0, 1)));
  } else {
    node.append(...answer(msg.id));
  }
  return node;
}

function typing() {
  const node = el('div', 'chat__msg chat__msg--bot');
  const dots = el('span', 'typing');
  dots.setAttribute('role', 'status');
  dots.setAttribute('aria-label', t('a11y.typing'));
  dots.append(el('i'), el('i'), el('i'));
  node.append(dots);
  return node;
}

function render() {
  const nodes = history.map(bubble);
  if (pending || waiting) nodes.push(typing());
  els.log.replaceChildren(...nodes);
  els.log.scrollTop = els.log.scrollHeight;
}

// Mientras la IA responde no se puede preguntar otra cosa (ni por chip)
function setWaiting(on) {
  waiting = on;
  els.root.setAttribute('aria-busy', String(on));
  els.input.disabled = on;
  els.send.disabled = on;
  els.chips.querySelectorAll('button').forEach((b) => { b.disabled = on; });
  if (!on) els.input.focus();
}

function markChip(id) {
  els.chips.querySelectorAll('[data-ask]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.ask === id));
  });
}

function flush() {
  if (!pending) return;
  clearTimeout(pending.timer);
  history.push(pending.msg);
  pending = null;
}

function reply(msg) {
  pending = {
    msg,
    timer: setTimeout(() => {
      flush();
      render();
    }, TYPING_MS),
  };
  render();
}

export function ask(id) {
  if (!tr(`chat.answers.${id}`)) return;
  flush(); // si Claudia estaba "escribiendo", su respuesta queda antes de la nueva pregunta
  markChip(id);
  history.push({ from: 'user', id });
  reply({ from: 'bot', id });
}

/* Texto libre -------------------------------------------------------------- */

function sessionCount() {
  try { return Number(sessionStorage.getItem(COUNT_KEY)) || 0; } catch { return 0; }
}
function bumpSessionCount() {
  try { sessionStorage.setItem(COUNT_KEY, String(sessionCount() + 1)); } catch { /* modo privado */ }
}

// Contexto para la IA: sólo pares pregunta libre → respuesta de la IA, así los
// turnos alternan user/model (las preguntas que terminaron en error no van)
function aiHistory() {
  const turns = [];
  history.forEach((m, i) => {
    const next = history[i + 1];
    if (m.from === 'user' && m.text && next?.kind === 'ai') {
      turns.push({ role: 'user', text: m.text }, { role: 'model', text: next.text });
    }
  });
  return turns.slice(-MAX_HISTORY);
}

async function askAI(message) {
  const ctx = aiHistory();
  history.push({ from: 'user', text: message });

  if (sessionCount() >= MAX_FREE_PER_SESSION) {
    history.push({ from: 'bot', kind: 'error', key: 'limit' });
    render();
    return;
  }
  bumpSessionCount();

  setWaiting(true);
  render();
  let msg;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, lang: getLang(), history: ctx }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.reply) msg = { from: 'bot', kind: 'ai', text: body.reply };
    else msg = { from: 'bot', kind: 'error', key: res.status === 429 ? 'busy' : 'unavailable' };
  } catch {
    msg = { from: 'bot', kind: 'error', key: 'unavailable' };   // timeout o sin red
  }
  history.push(msg);
  setWaiting(false);
  render();
}

function onSubmit(e) {
  e.preventDefault();
  if (waiting) return;
  const text = els.input.value.trim().slice(0, 500);
  if (!text) return;
  els.input.value = '';
  flush();
  markChip(null);
  if (CHAT_FREE_TEXT) {
    askAI(text);
  } else {
    history.push({ from: 'user', text });
    reply({ from: 'bot', kind: 'soon' });
  }
}

export async function initChat() {
  const root = document.getElementById('chat');
  if (!root) return;
  els = {
    root,
    log: root.querySelector('.chat__log'),
    chips: root.querySelector('.chat__chips'),
    form: root.querySelector('.chat__form'),
    input: root.querySelector('.chat__input'),
    send: root.querySelector('.chat__send'),
  };

  els.chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-ask]');
    if (chip && !waiting) ask(chip.dataset.ask);
  });
  els.form.addEventListener('submit', onSubmit);
  document.addEventListener('i18n:change', render);

  const [projects, stack, education, contact] = await Promise.all(
    ['projects', 'stack', 'education', 'contact'].map(loadData),
  );
  data = { projects: projects.projects || [], groups: stack.groups || [], certs: education.certs || [], contact };
  render();
}
