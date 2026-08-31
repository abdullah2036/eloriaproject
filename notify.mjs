/* ═══════════════════════════════════════════════════════════════
   إيلوريا ستوري — مُرسل الإشعارات (زر يدوي)
   Eloria Story — manual notifier

   Triggered by: .eloria/send-request.json  (written by her 📢 button,
                 through the same GitHub token she already uses to publish)

   READS  : data.json                  (read-only, ALWAYS — never written here)
            subscribers.json           (optional, if she prefers a file)
            $SUBSCRIBERS               (optional, GitHub secret — recommended)
   WRITES : .eloria/announced.json     (log of what was already announced)
            covers/<novelId>.jpg       (email preview image)

   Stages:
     node notify.mjs prepare   → validate request, extract cover, write .notify-plan.json
     node notify.mjs send      → send one email per subscriber, update the log
   ═══════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

const ROOT       = process.cwd();
const DATA_FILE  = path.join(ROOT, 'data.json');
const REQ_FILE   = path.join(ROOT, '.eloria', 'send-request.json');
const ANN_FILE   = path.join(ROOT, '.eloria', 'announced.json');
const SUBS_FILE  = path.join(ROOT, 'subscribers.json');
const PLAN_FILE  = path.join(ROOT, '.notify-plan.json');   // temp, never committed
const COVER_DIR  = path.join(ROOT, 'covers');

const {
  SMTP_HOST = 'smtp.gmail.com',
  SMTP_PORT = '587',
  SMTP_USER,                       // her Gmail address
  SMTP_PASS,                       // 16-char Google App Password
  SENDER_NAME = 'إيلوريا ستوري',
  SITE_URL    = 'https://abdullah2036.github.io/eloriaproject',
  SUBSCRIBERS = '',                // "a@x.com, b@y.com"  (GitHub secret)
  DRY_RUN     = 'false',
} = process.env;

const SITE  = SITE_URL.replace(/\/+$/, '');
const DRY   = DRY_RUN === 'true';
const stage = process.argv[2];

const readJSON = (p, f = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } };
const writeJSON = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2)); };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ─────────── who gets the email ─────────── */
function loadSubscribers() {
  const out = new Map();                       // email → name
  const add = (email, name = '') => {
    const e = String(email || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && !out.has(e)) out.set(e, name);
  };

  // 1. GitHub secret (recommended: nothing personal ends up in a public repo)
  SUBSCRIBERS.split(/[,\n;]+/).forEach(x => add(x));

  // 2. subscribers.json in the repo (simpler to edit, but public — see SETUP)
  const file = readJSON(SUBS_FILE);
  const list = Array.isArray(file) ? file : (file?.subscribers || []);
  list.forEach(x => (typeof x === 'string' ? add(x) : add(x.email, x.name)));

  return [...out].map(([email, name]) => ({ email, name }));
}

/* ─────────── stage: prepare ─────────── */
function prepare() {
  const req = readJSON(REQ_FILE);
  if (!req || !Array.isArray(req.items) || req.items.length === 0) {
    console.log('No send request (or empty). Nothing to do.');
    return writeJSON(PLAN_FILE, { send: false });
  }

  const data = readJSON(DATA_FILE);
  if (!data || !Array.isArray(data.novels)) {
    console.log('data.json unreadable — aborting, nothing sent.');
    return writeJSON(PLAN_FILE, { send: false });
  }

  const novels = [], chapters = [];
  let heroNovel = null;

  for (const it of req.items.slice(0, 20)) {         // sanity cap
    const n = data.novels.find(x => x.id === it.novelId);
    if (!n) continue;                                // deleted since she clicked
    heroNovel ||= n;
    if (it.type === 'novel') {
      novels.push({ id: n.id, title: n.title, desc: (n.desc || '').slice(0, 220) });
    } else {
      const c = (n.chapters || []).find(x => x.id === it.chapterId);
      if (!c) continue;
      chapters.push({
        novelId: n.id, novelTitle: n.title, id: c.id, title: c.title,
        excerpt: String(c.text || '').replace(/\s+/g, ' ').slice(0, 220),
      });
    }
  }

  if (!novels.length && !chapters.length) {
    console.log('Requested items no longer exist in data.json. Nothing sent.');
    return writeJSON(PLAN_FILE, { send: false });
  }

  // Covers are base64 data: URIs inside data.json, and data: URIs do NOT render
  // in Gmail or Outlook — so the cover has to become a real file on the site.
  let imageUrl = '';
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(heroNovel?.cover || '');
  if (m) {
    const ext  = m[1].toLowerCase() === 'png' ? 'png' : m[1].toLowerCase() === 'webp' ? 'webp' : 'jpg';
    const file = `${heroNovel.id}.${ext}`;
    fs.mkdirSync(COVER_DIR, { recursive: true });
    fs.writeFileSync(path.join(COVER_DIR, file), Buffer.from(m[2], 'base64'));
    imageUrl = `${SITE}/covers/${file}`;
  } else if (/^https?:\/\//.test(heroNovel?.cover || '')) {
    imageUrl = heroNovel.cover;
  }

  writeJSON(PLAN_FILE, { send: true, imageUrl, novels, chapters, note: String(req.note || '').slice(0, 400) });
  console.log(`Prepared: ${novels.length} novel(s), ${chapters.length} chapter(s).`);
}

/* ─────────── the email ─────────── */
const subjectOf = p =>
  p.novels.length          ? `رواية جديدة على إيلوريا ستوري ✦ ${p.novels[0].title}`
  : p.chapters.length === 1 ? `تم نشر فصل جديد! ✦ ${p.chapters[0].novelTitle}`
  :                           'فصول جديدة على إيلوريا ستوري ✦';

function htmlOf(p, name) {
  const card = (title, sub, body, href) => `
    <tr><td style="padding:0 0 18px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #EEDCF6;border-radius:18px">
        <tr><td style="padding:20px 22px">
          <div style="font-size:13px;color:#A98FAF">${esc(sub)}</div>
          <div style="font-size:19px;font-weight:700;color:#6E597D;margin:6px 0 10px">${esc(title)}</div>
          ${body ? `<div style="font-size:15px;line-height:2;color:#5b4f63">${esc(body)}…</div>` : ''}
          <div style="margin-top:16px">
            <a href="${href}" style="display:inline-block;background:#6E597D;color:#fdf8ff;text-decoration:none;padding:11px 26px;border-radius:999px;font-size:15px">اقرأ الآن ←</a>
          </div>
        </td></tr>
      </table>
    </td></tr>`;

  const items = [
    ...p.novels.map(n => card(n.title, 'رواية جديدة ✦', n.desc, `${SITE}/#/novel/${n.id}`)),
    ...p.chapters.map(c => card(c.title, `تم نشر فصل جديد! · ${c.novelTitle}`, c.excerpt, `${SITE}/#/read/${c.novelId}/${c.id}`)),
  ].join('');

  return `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFF9F5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F5;padding:28px 12px;font-family:Tahoma,Arial,sans-serif">
    <tr><td align="center"><table width="100%" style="max-width:560px" cellpadding="0" cellspacing="0">

      <tr><td align="center" style="padding-bottom:18px">
        <div style="font-size:22px">🪶</div>
        <div style="font-size:15px;letter-spacing:.35em;color:#A98FAF">ELORIA STORY</div>
      </td></tr>

      ${name ? `<tr><td style="padding-bottom:14px;font-size:16px;color:#6E597D">${esc(name)}، ✦</td></tr>` : ''}
      ${p.note ? `<tr><td style="padding-bottom:18px;font-size:15px;line-height:2;color:#5b4f63">${esc(p.note)}</td></tr>` : ''}

      ${p.imageUrl ? `<tr><td align="center" style="padding-bottom:20px">
        <img src="${p.imageUrl}" width="200" alt=""
             style="width:200px;max-width:60%;border-radius:14px;border:1px solid #EEDCF6"></td></tr>` : ''}

      ${items}

      <tr><td align="center" style="padding-top:10px;font-size:12px;color:#A98FAF;line-height:2">
        وصلتك هذه الرسالة لأنك في قائمة قرّاء إيلوريا ستوري.<br>
        للتوقف عن الاستلام، ردّي على هذه الرسالة بكلمة «إلغاء».<br>
        <a href="${SITE}" style="color:#A98FAF">زيارة الموقع</a>
      </td></tr>

    </table></td></tr>
  </table>
</body></html>`;
}

/* ─────────── stage: send ─────────── */
async function send() {
  const plan = readJSON(PLAN_FILE);
  if (!plan?.send) { console.log('Nothing to send.'); return; }

  const subs = loadSubscribers();
  const subject = subjectOf(plan);
  console.log(`Subject: ${subject}`);
  console.log(`Recipients: ${subs.length}`);

  if (DRY) { console.log('DRY RUN — no mail sent.'); console.log(htmlOf(plan, 'اسم القارئ').slice(0, 900)); return; }
  if (!subs.length) { console.log('No subscribers configured — nothing sent.'); return; }
  if (!SMTP_USER || !SMTP_PASS) throw new Error('Missing SMTP_USER / SMTP_PASS secrets.');

  const tx = nodemailer.createTransport({
    host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  // One message each — so nobody sees anyone else's address.
  const sent = [];
  for (const s of subs) {
    try {
      await tx.sendMail({
        from: `"${SENDER_NAME}" <${SMTP_USER}>`,
        to: s.email, subject, html: htmlOf(plan, s.name),
        text: `${subject}\n${SITE}`,
      });
      sent.push(s.email);
      console.log(`  ✓ ${s.email}`);
    } catch (e) {
      console.log(`  ✗ ${s.email} — ${e.message}`);   // one bad address must not stop the rest
    }
  }
  if (!sent.length) throw new Error('Every send failed — check SMTP credentials.');

  // Log what went out, so the button can show "already announced" next time.
  const ann = readJSON(ANN_FILE, { novels: [], chapters: [], history: [] });
  plan.novels.forEach(n => ann.novels.includes(n.id) || ann.novels.push(n.id));
  plan.chapters.forEach(c => { const k = `${c.novelId}:${c.id}`; ann.chapters.includes(k) || ann.chapters.push(k); });
  ann.history = [{ at: new Date().toISOString(), subject, recipients: sent.length }, ...(ann.history || [])].slice(0, 30);
  writeJSON(ANN_FILE, ann);
  console.log(`✓ Sent to ${sent.length}/${subs.length}.`);
}

if (stage === 'prepare') prepare();
else if (stage === 'send') await send();
else { console.error('usage: node notify.mjs prepare|send'); process.exit(1); }
