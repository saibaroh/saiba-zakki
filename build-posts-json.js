#!/usr/bin/env node
/**
 * build-posts-json.js
 *
 * Reads frontmatter from blog/posts/*.md and writes posts.json.
 *
 * Usage:
 *   node build-posts-json.js          # process both en and ja
 *   node build-posts-json.js en       # process en only
 *   node build-posts-json.js ja       # process ja only
 *
 * Frontmatter fields (YAML between --- delimiters):
 *   title      (required)
 *   titleHtml  (optional, defaults to title)
 *   date       (required, YYYY-MM-DD)
 *   category   (required)
 *   lead       (required)
 *   thumbnail  (optional, defaults to "")
 *   slug       (optional, defaults to filename without .md)
 */

const fs = require('fs');
const path = require('path');

// Minimal frontmatter parser — handles quoted and unquoted single-line values.
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const block = match[1];
  const data = {};

  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();

    // Strip surrounding double quotes and unescape \"
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\"/g, '"');
    }

    data[key] = val;
  }

  return data;
}

function buildForLang(lang) {
  const postsDir = path.join(__dirname, lang, 'blog', 'posts');
  const outFile  = path.join(__dirname, lang, 'blog', 'posts.json');

  if (!fs.existsSync(postsDir)) {
    console.error(`[${lang}] posts directory not found: ${postsDir}`);
    return;
  }

  const files = fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md'))
    .sort();

  const posts = [];

  for (const file of files) {
    const slug    = path.basename(file, '.md');
    const content = fs.readFileSync(path.join(postsDir, file), 'utf8');
    const fm      = parseFrontmatter(content);

    if (!fm) {
      console.warn(`[${lang}] No frontmatter found in ${file} — skipped`);
      continue;
    }

    const missing = ['title', 'date', 'category', 'lead'].filter(k => !fm[k]);
    if (missing.length) {
      console.warn(`[${lang}] Missing required fields in ${file}: ${missing.join(', ')} — skipped`);
      continue;
    }

    posts.push({
      slug:      fm.slug      || slug,
      title:     fm.title,
      titleHtml: fm.titleHtml || fm.title,
      date:      fm.date,
      category:  fm.category,
      lead:      fm.lead,
      thumbnail: fm.thumbnail || '',
    });
  }

  // Sort newest first (same order as the blog page JS)
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(outFile, JSON.stringify(posts, null, 2) + '\n', 'utf8');
  console.log(`[${lang}] Wrote ${posts.length} post(s) to ${path.relative(__dirname, outFile)}`);
}

const target = process.argv[2];

if (!target || target === 'en') buildForLang('en');
if (!target || target === 'ja') buildForLang('ja');
