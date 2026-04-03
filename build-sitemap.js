#!/usr/bin/env node
/**
 * build-sitemap.js
 *
 * Generates sitemap.xml from static pages + both en/ja posts.json.
 *
 * Usage:
 *   node build-sitemap.js
 */

const fs   = require('fs');
const path = require('path');

const BASE = 'https://saiba-zakki.com';

// Static pages: [path, priority, changefreq]
const STATIC_PAGES = [
  ['/',          '1.0', 'monthly'],
  ['/en/',       '0.9', 'monthly'],
  ['/ja/',       '0.9', 'monthly'],
  ['/en/blog/',  '0.8', 'weekly'],
  ['/ja/blog/',  '0.8', 'weekly'],
];

function readPosts(lang) {
  const file = path.join(__dirname, lang, 'blog', 'posts.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function url(loc, lastmod, priority, changefreq) {
  const lines = ['  <url>', `    <loc>${loc}</loc>`];
  if (lastmod)   lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority)  lines.push(`    <priority>${priority}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

const entries = [];

for (const [p, priority, changefreq] of STATIC_PAGES) {
  entries.push(url(BASE + p, null, priority, changefreq));
}

for (const lang of ['en', 'ja']) {
  const posts = readPosts(lang);
  for (const post of posts) {
    const loc = `${BASE}/${lang}/blog/post/?slug=${post.slug}`;
    entries.push(url(loc, post.date, '0.7', 'never'));
  }
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries,
  '</urlset>',
].join('\n') + '\n';

const out = path.join(__dirname, 'sitemap.xml');
fs.writeFileSync(out, xml, 'utf8');
console.log(`Wrote sitemap.xml with ${entries.length} URLs`);
