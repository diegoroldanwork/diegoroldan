/* ==========================================================================
   POST /api/chat — Claudia con Gemini.

   Entrada: { message, lang, history: [{ role: "user" | "model", text }] }
   Salida:  200 { reply }  ·  4xx/5xx { error, reply }  (reply siempre es un
            mensaje que se puede mostrar al visitante)

   Variables de entorno: GEMINI_API_KEY (obligatoria), GEMINI_MODEL (opcional).
   ========================================================================== */

import { LANGS, I18N, CONTACT, systemPrompt } from '../lib/knowledge.mjs';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const ENDPOINT = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const MAX_MESSAGE = 500;
const MAX_HISTORY = 6;          // mensajes previos (3 idas y vueltas)
const MAX_HISTORY_TEXT = 2000;  // por mensaje del historial
const MAX_BODY = 16 * 1024;
const GEMINI_TIMEOUT_MS = 15000; // el front corta a los 20 s

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Respuesta amable + email, en el idioma del visitante
function fail(status, error, lang = 'es') {
  const key = error === 'rate_limited' ? 'busy' : 'unavailable';
  return json(status, { error, reply: `${I18N[lang].chat.errors[key]} ${CONTACT.email}` });
}

function validate(body) {
  if (!body || typeof body !== 'object') return 'body';
  const { message, lang, history = [] } = body;
  if (!LANGS.includes(lang)) return 'lang';
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) return 'message';
  if (!Array.isArray(history) || history.length > MAX_HISTORY) return 'history';
  const okTurn = (h) => h && (h.role === 'user' || h.role === 'model')
    && typeof h.text === 'string' && h.text.trim() && h.text.length <= MAX_HISTORY_TEXT;
  if (!history.every(okTurn)) return 'history';
  return null;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // Sólo desde el propio sitio (los navegadores mandan Origin en los POST)
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host) return json(403, { error: 'forbidden' });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'too_large' });

  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'invalid', field: 'body' }); }

  const invalid = validate(body);
  if (invalid) return json(400, { error: 'invalid', field: invalid });

  const { message, lang, history = [] } = body;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('chat: falta GEMINI_API_KEY');
    return fail(500, 'unavailable', lang);
  }

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: message.trim() }] },
  ];

  let res;
  try {
    res = await fetch(ENDPOINT(MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt(lang) }] },
        contents,
        generationConfig: { maxOutputTokens: 800 },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('chat: Gemini no respondió', err.name);
    return fail(504, 'unavailable', lang);
  }

  if (res.status === 429) return fail(429, 'rate_limited', lang);
  if (!res.ok) {
    console.error('chat: Gemini', res.status, (await res.text()).slice(0, 300));
    return fail(502, 'unavailable', lang);
  }

  const data = await res.json().catch(() => null);
  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!reply) {
    console.error('chat: respuesta vacía', data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason);
    return fail(502, 'unavailable', lang);
  }

  return json(200, { reply });
}

export const config = { path: '/api/chat' };
