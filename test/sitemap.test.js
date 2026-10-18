const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectUrls } = require('../build-sitemap');
const BASE = 'https://shogi.saiba-zakki.com';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shogi-sitemap-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, write(file, head) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `<html><head>${head}</head><body></body></html>`);
  }};
}
const canonical = route => `<link href='${BASE}${route}' rel='canonical'>`;
test('discovers new published sections; excludes errors, tests, noindex, redirects and aliases', t => {
  const { root, write } = fixture(t);
  write('index.html', canonical('/'));
  write('ja/new-section/index.html', canonical('/ja/new-section/'));
  write('ja/alias/index.html', canonical('/ja/new-section/'));
  write('404.html', '');
  write('ja/404.html', '');
  write('test/index.html', canonical('/test/'));
  write('ja/test/index.html', canonical('/ja/test/'));
  write('ja/private/index.html', '<meta content="noindex, follow" name="robots">');
  write('ja/redirect/index.html', '<meta http-equiv="refresh" content="0;url=/">');
  write('en/blog/post/index.html', '<script>location.replace("../")</script>');
  write('_site/en/stale/index.html', canonical('/en/stale/'));
  assert.deepEqual(collectUrls(root), [BASE+'/', BASE+'/ja/new-section/']);
});
test('fails for missing, duplicate, foreign, non-normalized or unresolved canonicals', t => {
  const { root, write } = fixture(t);
  for (const head of ['', canonical('/')+canonical('/'), canonical('/missing/'),
    '<link rel="canonical" href="https://example.com/">', canonical('/index.html'), canonical('/?x=1'), canonical('/#top')]) {
    write('index.html', head);
    assert.throws(() => collectUrls(root));
  }
});
test('repository includes all guides, castles and glossaries', () => {
  const urls = collectUrls(path.resolve(__dirname, '..'));
  assert.equal(new Set(urls).size, urls.length);
  for (const lang of ['ja','en']) for (const section of ['guide','castles','glossary']) {
    assert.ok(urls.includes(`${BASE}/${lang}/${section}/`));
  }
});
