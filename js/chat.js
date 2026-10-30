/* ==========================================================================
   Chat con Claudia: preguntas rápidas con respuestas fijas (i18n + data/) y
   texto libre que, por ahora, responde con un aviso de "próximamente".

   El historial se guarda como claves, no como texto: al cambiar de idioma
   se vuelve a dibujar entero en el idioma nuevo.
   ========================================================================== */

import { t, tr } from './i18n.js';
import { loadData, pick, el } from './data.js';
import { stackGroups, certMeta } from './sections.js';

const CONTACT = [
  { label: 'Email', href: 'mailto:diegoroldan.work@gmail.com' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/diegonicolasroldan/', external: true },
  { label: 'GitHub', href: 'https://github.com/diegoroldanwork', external: true },
  { label: 'WhatsApp', href: 'https://wa.me/5548999733214', external: true },
];

// Sección a la que lleva el link "Ver…" de cada respuesta
const SECTION = { about: 'sobre-mi', projects: 'proyectos', stack: 'stack', certs: 'formacion' };

const TYPING_MS = 650;

const history = [{ from: 'bot', kind: 'greeting' }];
let data = { projects: [], groups: [], certs: [] };
let pending = null;
let els = {};

// "Soy **Diego**" → Soy <strong>Diego</strong>
function rich(text) {
  const p = el('p');
  text.split(/\*\*([^*]+)\*\*/).forEach((part, i) => {
    p.append(i % 2 ? el('strong', null, part) : document.createTextNode(part));
  });
  return p;
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

  if (id === 'contact') parts.push(linkRow(CONTACT));
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
  if (pending) nodes.push(typing());
  els.log.replaceChildren(...nodes);
  els.log.scrollTop = els.log.scrollHeight;
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

function onSubmit(e) {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  els.input.value = '';
  flush();
  markChip(null);
  history.push({ from: 'user', text });
  reply({ from: 'bot', kind: 'soon' });
}

export async function initChat() {
  const root = document.getElementById('chat');
  if (!root) return;
  els = {
    log: root.querySelector('.chat__log'),
    chips: root.querySelector('.chat__chips'),
    form: root.querySelector('.chat__form'),
    input: root.querySelector('.chat__input'),
  };

  els.chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-ask]');
    if (chip) ask(chip.dataset.ask);
  });
  els.form.addEventListener('submit', onSubmit);
  document.addEventListener('i18n:change', render);

  const [projects, stack, education] = await Promise.all([loadData('projects'), loadData('stack'), loadData('education')]);
  data = { projects: projects.projects || [], groups: stack.groups || [], certs: education.certs || [] };
  render();
}
