#!/usr/bin/env node
/**
 * build.js — 記事追加後に実行するビルドスクリプト
 *
 * Usage:
 *   node build.js          # en・ja 両方
 *   node build.js en       # en のみ
 *   node build.js ja       # ja のみ
 *
 * 実行内容:
 *   1. frontmatter → posts.json
 *   2. posts.json  → sitemap.xml
 *   3. posts.json  → feed.xml (RSS)
 */

const { execSync } = require('child_process');

const target = process.argv[2] || '';
const arg    = target ? ` ${target}` : '';

const run = cmd => execSync(`node ${cmd}`, { stdio: 'inherit', cwd: __dirname });

run(`build-posts-json.js${arg}`);
run('build-sitemap.js');
run('build-rss.js');
