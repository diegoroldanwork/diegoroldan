import { initI18n } from './i18n.js';

initI18n();

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
