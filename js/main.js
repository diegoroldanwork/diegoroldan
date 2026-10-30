import { initI18n } from './i18n.js';
import { initChat } from './chat.js';

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

await initI18n();
initChat();
