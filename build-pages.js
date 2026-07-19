#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = __dirname;
const outputDir = path.join(root, '_site');

const publishPaths = [
  '404.html',
  'CNAME',
  'robots.txt',
  'sitemap.xml',
  'index.html',
  'feed.xml',
  'css',
  'en',
  'images',
  'ja',
  'js',
  'lib',
];

const excludedExtensions = new Set(['.md']);

function removeExcludedFiles(targetDir) {
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      removeExcludedFiles(entryPath);
      continue;
    }

    if (excludedExtensions.has(path.extname(entry.name))) {
      fs.rmSync(entryPath);
    }
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const publishPath of publishPaths) {
  const source = path.join(root, publishPath);
  if (!fs.existsSync(source)) continue;

  fs.cpSync(source, path.join(outputDir, publishPath), {
    recursive: true,
    dereference: true,
  });
}

removeExcludedFiles(outputDir);
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');
