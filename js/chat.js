/* ==========================================================================
   Chat con Claudia: preguntas rápidas con respuestas fijas (i18n) y texto
   libre que, por ahora, responde con un aviso de "próximamente".

   El historial se guarda como claves, no como texto: al cambiar de idioma
   se vuelve a dibujar entero en el idioma nuevo.
   ========================================================================== */

import { t, tr, getLang } from './i18n.js';

const CONTACT = [
  { label: 'Email', href: 'mailto:diegoroldan.work@gmail.com' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/diegonicolasroldan/', external: true },
  { label: 'GitHub', href: 'https://github.com/diegoroldanwork', external: true },
  { label: 'WhatsApp', href: 'https://wa.me/5548999733214', external: true },
];

const TYPING_MS = 650;

const history = [{ from: 'bot', kind: 'greeting' }];
let projects = [];
let pending = null;
let els = {};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

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

function tags(items) {
  const list = el('ul', 'tags');
  items.forEach((tag) => list.append(el('li', null, tag)));
  return list;
}

function contactLinks() {
  const row = el('div', 'chat__links');
  CONTACT.forEach(({ label, href, external }) => {
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
  const data = tr(`chat.answers.${id}`) || {};
  const parts = [rich(data.text || '')];
  if (id === 'projects' && projects.length) {
    const lang = getLang();
    parts.push(cards(projects.map((p) => ({ title: p.title[lang], desc: p.description[lang] }))));
  }
  if (data.cards) parts.push(cards(data.cards));
  if (data.tags) parts.push(tags(data.tags));
  if (id === 'contact') parts.push(contactLinks());
  return parts;
}

function bubble(msg) {
  const node = el('div', `chat__msg chat__msg--${msg.from}`);
  if (msg.from === 'user') {
    node.textContent = msg.text ?? tr(`chat.answers.${msg.id}.q`);
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

async function loadProjects() {
  try {
    const res = await fetch('data/projects.json');
    if (res.ok) projects = (await res.json()).projects || [];
  } catch (err) {
    console.error(err);
  }
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

  // Chips del chat y links de la navegación con data-ask
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-ask]');
    if (!trigger) return;
    e.preventDefault();
    if (!root.contains(trigger)) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
    ask(trigger.dataset.ask);
  });
  els.form.addEventListener('submit', onSubmit);
  document.addEventListener('i18n:change', render);

  await loadProjects();
  render();
}
