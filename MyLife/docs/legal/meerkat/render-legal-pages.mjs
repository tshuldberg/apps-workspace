#!/usr/bin/env node
// Renders each Meerkat legal .md source in this directory into a
// self-contained, publish-ready .html page (same basename), plus index.html.
// The DRAFT banner and fields panel render only while the frontmatter status
// contains "DRAFT"; flipping status after counsel approval produces the clean
// production page with no other changes.
// Usage: node docs/legal/meerkat/render-legal-pages.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const ORDER = [
  'terms-of-use.md',
  'privacy-policy.md',
  'community-standards.md',
  'safety-and-appeals.md',
  'dmca-policy.md',
  'law-enforcement-guidelines.md',
  'data-deletion-instructions.md',
];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function parseFrontmatter(src) {
  const m = src.match(/^---\n([^]*?)\n---\n([^]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  let currentList = null;
  for (const line of m[1].split('\n')) {
    const listItem = line.match(/^\s+- "(.*)"$/) ?? line.match(/^\s+- (.*)$/);
    if (listItem && currentList) { meta[currentList].push(listItem[1]); continue; }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      if (kv[2] === '') { currentList = kv[1]; meta[kv[1]] = []; }
      else { currentList = null; meta[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1'); }
    }
  }
  return { meta, body: m[2] };
}

function inline(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([A-Z0-9][^\]]*)\]/g, '<mark>[$1]</mark>');
}

function mdToHtml(body) {
  const lines = body.split('\n');
  const out = [];
  let inList = null; // 'ol' | 'ul'
  const closeList = () => { if (inList) { out.push(`</${inList}>`); inList = null; } };
  for (const line of lines) {
    if (/^# /.test(line)) { closeList(); continue; } // page h1 comes from meta
    if (/^## /.test(line)) { closeList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    const ol = line.match(/^(\d+)\. (.*)$/);
    if (ol) {
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(ol[2])}</li>`); continue;
    }
    const ul = line.match(/^- (.*)$/);
    if (ul) {
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`); continue;
    }
    if (line.trim() === '') { closeList(); continue; }
    // The version line is rendered from frontmatter; skip the body duplicate.
    if (/^Version /.test(line)) { closeList(); continue; }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

function renderPage(meta, body, isDraft) {
  const banner = isDraft ? `
  <div class="draft-banner">DRAFT for counsel review · Not effective · Not legal advice</div>` : '';
  const fields = isDraft && Array.isArray(meta.fields) && meta.fields.length ? `
  <details class="fields"><summary>Fields to complete before publication (${meta.fields.length})</summary>
  <ul>${meta.fields.map((f) => `<li>${inline(f)}</li>`).join('')}</ul>
  <p class="fields-note">Wiring: ${esc(meta.envVar ?? 'n/a')}</p>
  </details>` : '';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title>
<style>
:root{color-scheme:light}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#FAF9F7;color:#26221E;font:16px/1.7 -apple-system,"SF Pro Text",Georgia,serif;padding:0 0 80px}
.page{max-width:720px;margin:0 auto;padding:0 24px}
header.site{border-bottom:1px solid #E7E2DB;background:#fff}
header.site .page{display:flex;align-items:baseline;gap:14px;padding:18px 24px}
header.site a{color:#26221E;text-decoration:none;font-weight:700;letter-spacing:.2px}
header.site span{color:#8A8073;font-size:13px}
.draft-banner{background:#93000A;color:#fff;text-align:center;padding:8px 16px;font:700 12.5px/1.4 -apple-system,sans-serif;letter-spacing:.8px;text-transform:uppercase}
h1{font-size:30px;line-height:1.25;margin:44px 0 6px;letter-spacing:-.3px}
.version{color:#8A8073;font-size:14px;margin-bottom:30px}
h2{font-size:19px;margin:34px 0 10px;letter-spacing:-.2px}
p{margin:0 0 14px}
ol,ul{margin:0 0 14px 26px}
li{margin-bottom:8px}
code{background:#F0EDE8;border:1px solid #E7E2DB;border-radius:5px;padding:1px 6px;font-size:13.5px;font-family:ui-monospace,"SF Mono",monospace}
mark{background:#FFF3C4;border-bottom:2px solid #E0B400;padding:0 3px;border-radius:3px;font-weight:600}
.fields{background:#fff;border:1px solid #E7E2DB;border-radius:12px;padding:14px 20px;margin:26px 0;font-family:-apple-system,sans-serif;font-size:14px}
.fields summary{cursor:pointer;font-weight:700;color:#8A5A00}
.fields ul{margin-top:10px}
.fields-note{color:#8A8073;font-size:12.5px;margin-top:8px}
footer{margin-top:60px;border-top:1px solid #E7E2DB;padding-top:18px;color:#8A8073;font-size:13px;font-family:-apple-system,sans-serif}
footer nav{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px}
footer a{color:#5A5348}
@media(prefers-color-scheme:dark){:root{color-scheme:dark}
body{background:#131318;color:#E4E1E9}header.site{background:#1B1B20;border-color:rgba(255,255,255,.08)}
header.site a{color:#E4E1E9}h1,h2{color:#F0EDE8}
code{background:#2A292F;border-color:rgba(255,255,255,.08)}
mark{background:#4d3f00;border-color:#E0B400;color:#F0EDE8}
.fields{background:#1B1B20;border-color:rgba(255,255,255,.08)}
.fields summary{color:#FFB877}
footer{border-color:rgba(255,255,255,.08)}footer a{color:#9F8E81}}
</style></head>
<body>${banner}
<header class="site"><div class="page"><a href="./index.html">Meerkat</a><span>Legal &amp; Safety</span></div></header>
<div class="page">
<h1>${esc(meta.title)}</h1>
<p class="version">Version ${esc(meta.version)} · Effective <mark>[DATE]</mark></p>
${fields}
${mdToHtml(body)}
<footer>
${isDraft ? '<p>This document is a draft prepared from the shipped product behavior and is not yet effective.</p>' : ''}
<nav>${ORDER.map((f) => `<a href="./${f.replace(/\.md$/, '.html')}">${esc(titleOf(f))}</a>`).join('')}</nav>
</footer>
</div></body></html>`;
}

const titles = {};
function titleOf(file) { return titles[file] ?? file; }

function main() {
  const rendered = [];
  const parsed = ORDER.map((file) => {
    const src = fs.readFileSync(path.join(DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(src);
    titles[file] = meta.title;
    return { file, meta, body };
  });
  for (const { file, meta, body } of parsed) {
    const isDraft = String(meta.status ?? '').includes('DRAFT');
    const html = renderPage(meta, body, isDraft);
    const out = path.join(DIR, file.replace(/\.md$/, '.html'));
    fs.writeFileSync(out, html);
    rendered.push({ file: path.basename(out), title: meta.title, isDraft, envVar: meta.envVar ?? 'n/a' });
  }
  const index = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Meerkat Legal &amp; Safety</title>
<style>:root{color-scheme:light dark}body{background:#FAF9F7;color:#26221E;font:16px/1.7 -apple-system,sans-serif;max-width:720px;margin:0 auto;padding:40px 24px}
h1{font-size:28px;margin-bottom:6px}p.sub{color:#8A8073;margin-bottom:30px}
a.card{display:block;background:#fff;border:1px solid #E7E2DB;border-radius:12px;padding:16px 20px;margin:10px 0;color:#26221E;text-decoration:none}
a.card:hover{border-color:#C9894D}a.card b{display:block}a.card span{color:#8A8073;font-size:13px}
.draft{display:inline-block;background:#93000A;color:#fff;font-size:10px;font-weight:700;letter-spacing:.8px;padding:1px 8px;border-radius:999px;margin-left:8px;vertical-align:2px}
@media(prefers-color-scheme:dark){body{background:#131318;color:#E4E1E9}a.card{background:#1B1B20;border-color:rgba(255,255,255,.08);color:#E4E1E9}a.card span{color:#9F8E81}}
</style></head><body>
<h1>Meerkat Legal &amp; Safety</h1><p class="sub">Policies and procedures for the Meerkat service.</p>
${rendered.map((r) => `<a class="card" href="./${r.file}"><b>${esc(r.title)}${r.isDraft ? '<span class="draft">DRAFT</span>' : ''}</b><span>${esc(r.envVar)}</span></a>`).join('\n')}
</body></html>`;
  fs.writeFileSync(path.join(DIR, 'index.html'), index);
  console.log('rendered', rendered.length, 'pages + index.html', rendered.every((r) => r.isDraft) ? '(all DRAFT)' : '');
}

main();
