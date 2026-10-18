#!/usr/bin/env node
/** Discover indexable HTML from the same paths that build-pages.js publishes.
 * Missing/invalid canonicals fail the build instead of silently losing pages.
 * Run: node build-sitemap.js [site-directory]
 */
const fs = require('fs');
const path = require('path');
const publishPaths = require('./lib/publish-paths');
const BASE = 'https://shogi.saiba-zakki.com';

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return result;
}

function discover(root) {
  const files = [];
  function walk(relative) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) return;
    if (fs.statSync(full).isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) walk(path.posix.join(relative, name));
    } else if (/\.html$/i.test(relative)) files.push(relative);
  }
  publishPaths.forEach(walk);
  return files;
}

function collectUrls(root) {
  const urls = new Set();
  const aliases = [];
  for (const file of discover(root)) {
    if (/(^|\/)(?:404\.html|test|tests)(\/|$)/i.test(file)) continue;
    const html = fs.readFileSync(path.join(root, file), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
    const meta = [...head.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
    if (meta.some(m => /^(robots|googlebot)$/i.test(m.name || '') && /\b(noindex|none)\b/i.test(m.content || ''))) continue;
    if (meta.some(m => /^refresh$/i.test(m['http-equiv'] || ''))) continue;
    if (/\blocation\.replace\s*\(/.test(head)) continue;
    const canonical = [...head.matchAll(/<link\b[^>]*>/gi)].map(m => attributes(m[0]))
      .filter(a => (a.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
    if (canonical.length !== 1 || !canonical[0].href) throw new Error(`${file}: expected one canonical URL`);
    const href = canonical[0].href;
    const url = new URL(href);
    if (url.origin !== BASE || url.search || url.hash || url.username || url.password || url.href !== href || /\/index\.html$/i.test(url.pathname)) {
      throw new Error(`${file}: invalid canonical ${href}`);
    }
    const ownUrl = BASE + '/' + file.replace(/(^|\/)index\.html$/, '$1');
    if (href !== ownUrl) {
      aliases.push([file, href]);
      continue;
    }
    urls.add(href);
  }
  for (const [file, href] of aliases) {
    if (!urls.has(href)) throw new Error(`${file}: canonical target is not an indexable published page: ${href}`);
  }
  return [...urls].sort();
}

function generate(root = __dirname) {
  const urls = collectUrls(root);
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n') + '\n</urlset>\n';
  fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
  console.log(`Wrote sitemap.xml with ${urls.length} canonical URLs`);
  return urls;
}
if (require.main === module) generate(process.argv[2] ? path.resolve(process.argv[2]) : __dirname);
module.exports = { collectUrls, generate };
