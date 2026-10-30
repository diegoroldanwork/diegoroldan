/* ==========================================================================
   Secciones generadas desde data/: proyectos, stack y formación.
   Se vuelven a dibujar al cambiar de idioma.
   ========================================================================== */

import { t } from './i18n.js';
import { loadData, pick, el, tagList, formatDate } from './data.js';

let data = { projects: [], groups: [], education: {} };

/* Proyectos -------------------------------------------------------------- */

function windowBar(title) {
  const bar = el('div', 'window__bar');
  const dots = el('span', 'window__dots');
  dots.setAttribute('aria-hidden', 'true');
  dots.append(el('i'), el('i'), el('i'));
  bar.append(dots, el('span', 'window__title', title));
  return bar;
}

function linkButton({ label, href, external }) {
  const a = el('a', 'btn btn--sm', pick(label));
  a.href = href;
  if (external) {
    a.target = '_blank';
    a.rel = 'noopener';
    a.append(el('span', 'sr-only', ` ${t('a11y.newTab')}`));
  }
  return a;
}

function projectCard(p) {
  const card = el('article', 'window project');
  card.append(windowBar(p.file));

  const body = el('div', 'window__body project__body');
  if (p.image) {
    card.classList.add('project--media');
    const fig = el('figure', 'project__media');
    const img = el('img');
    Object.assign(img, { src: p.image.src, width: p.image.width, height: p.image.height, alt: pick(p.image.alt), loading: 'lazy' });
    fig.append(img);
    body.append(fig);
  }

  const text = el('div', 'project__text');
  const meta = el('p', 'project__meta');
  meta.append(el('i', `dot dot--${p.statusKind}`), el('span', null, `${pick(p.status)} · ${p.year}`));
  text.append(el('h3', 'project__title', pick(p.title)), meta, el('p', 'project__short', pick(p.short)), el('p', 'project__detail', pick(p.detail)));

  if (p.stats) {
    const stats = el('ul', 'project__stats');
    pick(p.stats).forEach((s) => stats.append(el('li', null, s)));
    text.append(stats);
  }

  const role = el('p', 'project__role');
  role.append(el('strong', null, `${t('projects.role')}: `), document.createTextNode(pick(p.role)));
  text.append(role, tagList(p.tags));

  const links = (p.links || []).filter((l) => l.href);
  if (links.length || p.privateRepo) {
    const row = el('div', 'project__links');
    links.forEach((l) => row.append(linkButton(l)));
    if (p.privateRepo) row.append(el('span', 'project__note', t('projects.privateRepo')));
    text.append(row);
  }

  body.append(text);
  card.append(body);
  return card;
}

function renderProjects() {
  const root = document.getElementById('projects-list');
  if (root) root.replaceChildren(...data.projects.map(projectCard));
}

/* Stack ------------------------------------------------------------------ */

export function stackGroups(groups, className = 'stack') {
  const list = el('dl', className);
  groups.forEach((g) => {
    const item = el('div', `${className}__group${g.id === 'learning' ? ` ${className}__group--learning` : ''}`);
    const dd = el('dd');
    dd.append(tagList(g.items));
    if (g.note) dd.append(el('p', `${className}__note`, pick(g.note)));
    item.append(el('dt', null, pick(g.label)), dd);
    list.append(item);
  });
  return list;
}

function renderStack() {
  const root = document.getElementById('stack-list');
  if (root) root.replaceChildren(stackGroups(data.groups));
}

/* Formación + visor de certificados -------------------------------------- */

export function certMeta(c) {
  const parts = [c.issuer];
  if (c.date) parts.push(formatDate(c.date));
  if (c.grade) parts.push(`${t('education.grade')} ${c.grade}`);
  if (c.hours) parts.push(`${c.hours} ${t('education.hours')}`);
  return parts.join(' · ');
}

function renderEducation() {
  const courses = document.getElementById('courses');
  const certs = document.getElementById('certs');
  const { courses: cs = [], certs: list = [] } = data.education;

  if (courses) {
    courses.replaceChildren(...cs.map((c) => {
      const li = el('li', 'course');
      const status = el('span', 'course__status');
      status.append(el('i', 'dot dot--live'), document.createTextNode(pick(c.status)));
      li.append(el('strong', null, c.name), el('span', 'course__issuer', c.issuer), status);
      return li;
    }));
  }

  if (certs) {
    certs.replaceChildren(...list.map((c) => {
      const li = el('li');
      const btn = el('button', 'cert');
      btn.type = 'button';
      btn.dataset.cert = c.id;
      btn.setAttribute('aria-haspopup', 'dialog');
      const img = el('img');
      Object.assign(img, { src: c.image, width: c.width, height: c.height, alt: '', loading: 'lazy' });
      const text = el('span', 'cert__text');
      text.append(el('strong', null, c.name), el('span', null, certMeta(c)));
      btn.append(img, text, el('span', 'sr-only', ` — ${t('a11y.viewCert')}`));
      li.append(btn);
      return li;
    }));
  }
}

function initLightbox() {
  const dialog = document.getElementById('lightbox');
  if (!dialog) return;
  const img = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cert]');
    if (!btn) return;
    const c = (data.education.certs || []).find((x) => x.id === btn.dataset.cert);
    if (!c) return;
    Object.assign(img, { src: c.image, width: c.width, height: c.height, alt: `${t('a11y.certPrefix')} ${c.name}` });
    caption.textContent = `${c.name} · ${certMeta(c)}`;
    dialog.showModal();
  });

  // Cerrar con el botón o tocando fuera de la imagen (Esc lo maneja <dialog>)
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });
}

/* ------------------------------------------------------------------------- */

function renderAll() {
  renderProjects();
  renderStack();
  renderEducation();
}

export async function initSections() {
  const [projects, stack, education] = await Promise.all([loadData('projects'), loadData('stack'), loadData('education')]);
  data = { projects: projects.projects || [], groups: stack.groups || [], education };
  initLightbox();
  renderAll();
  document.addEventListener('i18n:change', renderAll);
}
