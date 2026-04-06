#!/usr/bin/env node
/**
 * build-glossary.js
 *
 * Applies glossary term auto-linking to hand-written HTML pages
 * (guide, castles, glossary pages).
 *
 * Only processes the content region between the INJECT header end marker
 * and the INJECT footer start marker, so headers/footers/navs are untouched.
 *
 * Usage:
 *   node build-glossary.js
 */

const fs   = require('fs');
const path = require('path');
const { linkGlossaryTerms } = require('./lib/glossary-links');

// Files to process — same list as build-inject.js (minus the top-level indexes
// which have no glossary-rich content worth linking)
const TARGET_FILES = [
  ['en/guide/index.html',    'en'],
  ['en/guide/1/index.html',  'en'],
  ['en/guide/2/index.html',  'en'],
  ['en/guide/3/index.html',  'en'],
  ['en/castles/index.html',  'en'],
  ['en/castles/1/index.html','en'],
  ['en/castles/2/index.html','en'],
  ['en/castles/3/index.html','en'],
  ['ja/guide/index.html',    'ja'],
  ['ja/guide/1/index.html',  'ja'],
  ['ja/guide/2/index.html',  'ja'],
  ['ja/guide/3/index.html',  'ja'],
  ['ja/castles/index.html',  'ja'],
  ['ja/castles/1/index.html','ja'],
  ['ja/castles/2/index.html','ja'],
  ['ja/castles/3/index.html','ja'],
];

// Markers that delimit the content region (written by build-inject.js)
const HEADER_END_RE = /<!-- \/INJECT:header -->/;
const FOOTER_START_RE = /<!-- INJECT:footer:/;

/**
 * Extract the content region between the header end and footer start markers.
 * Returns { before, content, after } or null if markers not found.
 */
function splitContent(html) {
  const headerEnd = html.search(HEADER_END_RE);
  if (headerEnd === -1) return null;

  const afterHeader = headerEnd + '<!-- /INJECT:header -->'.length;

  const footerStart = html.indexOf('<!-- INJECT:footer:', afterHeader);
  if (footerStart === -1) return null;

  return {
    before:  html.slice(0, afterHeader),
    content: html.slice(afterHeader, footerStart),
    after:   html.slice(footerStart),
  };
}

let updated = 0;

for (const [relPath, lang] of TARGET_FILES) {
  const absPath = path.join(__dirname, relPath);

  if (!fs.existsSync(absPath)) {
    console.warn(`[skip] File not found: ${relPath}`);
    continue;
  }

  const original = fs.readFileSync(absPath, 'utf8');
  const parts = splitContent(original);

  if (!parts) {
    console.warn(`[skip] INJECT markers missing: ${relPath}`);
    continue;
  }

  const linked = linkGlossaryTerms(parts.content, lang);

  if (linked === parts.content) {
    console.log(`[no-op]  ${relPath}`);
    continue;
  }

  const result = parts.before + linked + parts.after;
  fs.writeFileSync(absPath, result, 'utf8');
  updated++;
  console.log(`[linked] ${relPath}`);
}

console.log(`\nDone. Updated ${updated} file(s).`);
