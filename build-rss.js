#!/usr/bin/env node
/**
 * build-rss.js
 *
 * Generates en/blog/feed.xml and ja/blog/feed.xml from posts.json.
 *
 * Usage:
 *   node build-rss.js
 */

const fs   = require('fs');
const path = require('path');

const BASE = 'https://shogi.saiba-zakki.com';

const CHANNELS = {
  en: {
    title:       "Blog | Saiba's Shogi Portal",
    link:        `${BASE}/en/blog/`,
    description: "Shogi columns, tips, and thoughts from Saiba — helping beginners enjoy the game.",
    language:    'en',
  },
  ja: {
    title:       'ブログ | さいばの将棋ポータル',
    link:        `${BASE}/ja/blog/`,
    description: 'さいばによる将棋コラム・上達のヒントなどをお届けするブログです。',
    language:    'ja',
  },
};

function escape(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toRfc822(dateStr) {
  return new Date(dateStr).toUTCString();
}

function buildFeed(lang) {
  const postsFile = path.join(__dirname, lang, 'blog', 'posts.json');
  if (!fs.existsSync(postsFile)) {
    console.warn(`[${lang}] posts.json not found — skipped`);
    return;
  }

  const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  const ch = CHANNELS[lang];

  const items = posts.map(post => {
    const url = `${BASE}/${lang}/blog/posts/${post.slug}/`;
    const title = escape(post.title.replace(/<br>/g, ' '));
    const desc  = escape(post.lead);
    return [
      '    <item>',
      `      <title>${title}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <description>${desc}</description>`,
      `      <pubDate>${toRfc822(post.date)}</pubDate>`,
      '    </item>',
    ].join('\n');
  }).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escape(ch.title)}</title>`,
    `    <link>${ch.link}</link>`,
    `    <description>${escape(ch.description)}</description>`,
    `    <language>${ch.language}</language>`,
    items,
    '  </channel>',
    '</rss>',
  ].join('\n') + '\n';

  const out = path.join(__dirname, lang, 'blog', 'feed.xml');
  fs.writeFileSync(out, xml, 'utf8');
  console.log(`[${lang}] Wrote ${lang}/blog/feed.xml with ${posts.length} item(s)`);
}

buildFeed('en');
buildFeed('ja');
