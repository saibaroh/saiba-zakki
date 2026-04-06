#!/usr/bin/env node
/**
 * build-inject.js
 *
 * Injects the shared header/footer templates into hand-written HTML pages.
 *
 * First run (migration):
 *   Finds the existing <header class="site-header"> and back-to-top/<footer>
 *   blocks in each file and wraps them with INJECT comment markers.
 *
 * Subsequent runs:
 *   Finds the INJECT markers and replaces the content between them with
 *   freshly rendered template output.
 *
 * Inject comment format:
 *   <!-- INJECT:header:{lang}:{langswitchHref} -->
 *   ...rendered header...
 *   <!-- /INJECT:header -->
 *
 *   <!-- INJECT:footer:{lang}:{affiliate} -->
 *   ...rendered footer...
 *   <!-- /INJECT:footer -->
 *
 * Usage:
 *   node build-inject.js
 */

const fs   = require('fs');
const path = require('path');
const { renderHeader, renderFooter } = require('./lib/templates');

// ---------------------------------------------------------------------------
// Target files
// [relative path from repo root, lang, affiliate notice in footer?]
// ---------------------------------------------------------------------------
const INJECT_FILES = [
  ['en/index.html',          'en', true],
  ['en/guide/index.html',    'en', false],
  ['en/guide/1/index.html',  'en', false],
  ['en/guide/2/index.html',  'en', false],
  ['en/guide/3/index.html',  'en', false],
  ['en/castles/index.html',  'en', false],
  ['en/castles/1/index.html','en', false],
  ['en/castles/2/index.html','en', false],
  ['en/castles/3/index.html','en', false],
  ['en/glossary/index.html', 'en', false],
  ['ja/index.html',          'ja', true],
  ['ja/guide/index.html',    'ja', false],
  ['ja/guide/1/index.html',  'ja', false],
  ['ja/guide/2/index.html',  'ja', false],
  ['ja/guide/3/index.html',  'ja', false],
  ['ja/castles/index.html',  'ja', false],
  ['ja/castles/1/index.html','ja', false],
  ['ja/castles/2/index.html','ja', false],
  ['ja/castles/3/index.html','ja', false],
  ['ja/glossary/index.html', 'ja', false],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a file path like 'en/guide/1/index.html' to URL path '/en/guide/1/' */
function toUrlPath(filePath) {
  return '/' + filePath.replace(/index\.html$/, '');
}

/** Compute the corresponding URL in the other language */
function otherLangPath(filePath, lang) {
  const urlPath  = toUrlPath(filePath);
  const other    = lang === 'en' ? 'ja' : 'en';
  return urlPath.replace(`/${lang}/`, `/${other}/`);
}

// ---------------------------------------------------------------------------
// Per-block injection
// ---------------------------------------------------------------------------

/**
 * Replace or insert the header inject block.
 * Returns the modified content string.
 */
function injectHeader(content, filePath, lang) {
  const langswitchHref = otherLangPath(filePath, lang);
  const rendered       = renderHeader(lang, langswitchHref);
  const opener         = `<!-- INJECT:header:${lang}:${langswitchHref} -->`;
  const closer         = `<!-- /INJECT:header -->`;
  const block          = `${opener}\n${rendered}\n${closer}`;

  // Re-injection: existing markers found
  const existingRe = /<!-- INJECT:header:[^\n]+ -->\n[\s\S]*?\n<!-- \/INJECT:header -->/;
  if (existingRe.test(content)) {
    return content.replace(existingRe, block);
  }

  // Migration: no markers yet — find and replace the raw <header> element
  const headerRe = /<header\s+class="site-header">[\s\S]*?<\/header>/;
  if (headerRe.test(content)) {
    return content.replace(headerRe, block);
  }

  console.warn(`  [warn] No header found in ${filePath}`);
  return content;
}

/**
 * Remove a standalone back-to-top <script> block that may remain after
 * the footer injection replaced the old footer HTML.
 * Only removes it when the block contains ONLY back-to-top code.
 */
function removeStaleBackToTopScript(content) {
  // Matches a <script> block whose only content is the back-to-top
  // variable + scroll listener + click listener (no other logic).
  return content.replace(
    /\n\s*<script>\s*\n\s*(const|var|let) backToTop\s*=\s*document\.querySelector\((['"])\.back-to-top\2\);[\s\S]*?<\/script>/,
    ''
  );
}

/**
 * Replace or insert the footer inject block.
 * Returns the modified content string.
 */
function injectFooter(content, filePath, lang, affiliate) {
  const rendered = renderFooter(lang, { affiliate });
  const opener   = `<!-- INJECT:footer:${lang}:${affiliate} -->`;
  const closer   = `<!-- /INJECT:footer -->`;
  const block    = `${opener}\n${rendered}\n${closer}`;

  // Re-injection
  const existingRe = /<!-- INJECT:footer:[^\n]+ -->\n[\s\S]*?\n<!-- \/INJECT:footer -->/;
  if (existingRe.test(content)) {
    return content.replace(existingRe, block);
  }

  // Migration: find <button class="back-to-top"> … </footer>
  // The non-greedy match stops at the first </footer>, which is correct.
  const footerRe = /<button\s+class="back-to-top"[\s\S]*?<\/footer>/;
  if (footerRe.test(content)) {
    return content.replace(footerRe, block);
  }

  console.warn(`  [warn] No footer found in ${filePath}`);
  return content;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let updated = 0;

for (const [relPath, lang, affiliate] of INJECT_FILES) {
  const absPath = path.join(__dirname, relPath);

  if (!fs.existsSync(absPath)) {
    console.warn(`[skip] File not found: ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(absPath, 'utf8');
  const original = content;

  content = injectHeader(content, relPath, lang);
  content = injectFooter(content, relPath, lang, affiliate);
  content = removeStaleBackToTopScript(content);

  if (content !== original) {
    fs.writeFileSync(absPath, content, 'utf8');
    updated++;
    console.log(`[inject] ${relPath}`);
  } else {
    console.log(`[no-op]  ${relPath}`);
  }
}

console.log(`\nDone. Updated ${updated} file(s).`);
