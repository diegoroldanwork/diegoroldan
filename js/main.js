import { initI18n } from './i18n.js';
import { initNav } from './nav.js';
import { initChat } from './chat.js';
import { initSections } from './sections.js';

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

initNav();
await initI18n();
initChat();
initSections();
