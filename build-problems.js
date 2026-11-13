#!/usr/bin/env node
/**
 * build-problems.js
 *
 * Generates the "将棋の問題" (shogi problem) pages: next-move problems, tsume, and so on.
 *
 *   {lang}/problems/{n}.md  →  {lang}/problems/{n}/index.html
 *                           →  {lang}/problems/index.html (list, newest first)
 *
 * lang is ja or en. The same number in both languages is the same problem
 * (used for hreflang and the language switch).
 *
 * The file name is the problem number. Frontmatter:
 *
 *   ---
 *   title: "問題のタイトル"
 *   date: "2026-11-04"
 *   type: "next"           (next = 次の一手, tsume = 詰将棋, mate = 詰む？詰まない？, escape = 詰み逃れ; used by the list filter)
 *   level: "4級〜2級レベル"  (one of CFG[lang].levelOrder; used by the list filter)
 *   strategy: "ミレニアム"   (optional — opening / castle, shown next to the level)
 *   tag: "基本手筋"          (optional — theme such as a basic tesuji; shown and used by the list filter)
 *   lead: "一覧と検索結果に出る説明（答えは書かない）"
 *   draft: true            (optional — skips the problem)
 *   ---
 *
 * Thumbnail: images/problems/{lang}-{n}.webp, if present, is shown in the list
 * and used as the share image. Make it from the SFEN with shogi-kansousen-note's
 * `node scripts/sfen-diagram.mjs "<sfen>" --heading 第{n}問 --out <png>` (add --en
 * for English), then convert it to a 640px-wide WebP.
 *
 * In the body, a line containing only `<!-- answer -->` starts the answer.
 * Everything after it is folded into a "解答を見る" / "Show answer" toggle.
 * Optionally, a line containing only `<!-- hint -->` before it starts a hint,
 * folded into a "ヒントを見る" / "Show hint" toggle.
 *
 * Usage:
 *   node build-problems.js
 */

const fs   = require('fs');
const path = require('path');
const { marked } = require('marked');
const { linkGlossaryTerms } = require('./lib/glossary-links');
const { processBoards } = require('./lib/board-blocks');
const { renderHeader, renderFooter, FONT_LINKS } = require('./lib/templates');

const BASE_URL = 'https://shogi.saiba-zakki.com';
const GA_ID    = 'G-3QWHMZKB7V';
const CFG = {
  ja: {
    section:      '将棋の問題',
    siteName:     'さいばの将棋ポータル',
    listDesc:     '将棋ウォーズ四段のさいばが作った、オリジナルの次の一手と詰将棋の問題です。1問ずつ、盤面を見て考えてから解答を開けます。',
    listSubtitle: 'オリジナルの次の一手と詰将棋の問題です。',
    listNote:     '問題の解答は、全てソフトで検証済みです。',
    empty:        '問題はまだありません。',
    home:         'ホーム',
    author:       'さいば',
    label:        n => `第${n}問`,
    showAnswer:   '解答を見る',
    showHint:     'ヒントを見る',
    backToList:   '← 問題の一覧へ',
    prev:         '← 前の問題',
    next:         '次の問題 →',
    filterLevel:  'レベル',
    filterType:   '種類',
    filterTag:    'タグ',
    filterAll:    'すべて',
    noMatch:      '条件に合う問題はありません。',
    types:        { next: '次の一手', tsume: '詰将棋', mate: '詰む？詰まない？', escape: '詰み逃れ' },
    levelOrder:   ['入門', '10級〜5級レベル', '4級〜2級レベル', '1級〜二段レベル', '三段以上レベル', '難問'],
  },
  en: {
    section:      'Shogi Problems',
    siteName:     "Saiba's Shogi Portal",
    listDesc:     'Original next-move and tsume problems by Saiba, an amateur 4-dan on Shogi Wars. Think about each position, then open the answer.',
    listSubtitle: 'Original next-move and tsume problems.',
    listNote:     'All answers have been checked with a shogi engine.',
    empty:        'No problems yet.',
    home:         'Home',
    author:       'Saiba',
    label:        n => `Problem ${n}`,
    showAnswer:   'Show answer',
    showHint:     'Show hint',
    backToList:   '← All problems',
    prev:         '← Previous problem',
    next:         'Next problem →',
    filterLevel:  'Level',
    filterType:   'Type',
    filterTag:    'Tag',
    filterAll:    'All',
    noMatch:      'No problems match these filters.',
    types:        { next: 'Next move', tsume: 'Tsume', mate: 'Mate or not?', escape: 'Escape the mate' },
    levelOrder:   ['Beginner', '10 kyu to 5 kyu level', '4 kyu to 2 kyu level', '1 kyu to 2 dan level', '3 dan and above', 'Expert challenge'],
  },
};
const LANGS = Object.keys(CFG);
const dirOf     = lang => path.join(__dirname, lang, 'problems');
const listUrlOf = lang => `${BASE_URL}/${lang}/problems/`;
const thumbOf   = (lang, num) => {
  const rel = `/images/problems/${lang}-${num}.webp`;
  return fs.existsSync(path.join(__dirname, rel)) ? rel : null;
};
const ANSWER_MARKER = /^<!--\s*answer\s*-->\s*$/m;
const HINT_MARKER   = /^<!--\s*hint\s*-->\s*$/m;

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseFrontmatter(src, file) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) throw new Error(`${file}: frontmatter missing`);
  const data = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  for (const key of ['title', 'date', 'type', 'level', 'lead']) {
    if (!data[key]) throw new Error(`${file}: "${key}" is required`);
  }
  if (!Object.keys(CFG.ja.types).includes(data.type)) throw new Error(`${file}: "type" must be one of ${Object.keys(CFG.ja.types).join(', ')}`);
  return { data, body: src.slice(m[0].length) };
}

function renderMarkdown(md, lang) {
  const boards = processBoards(marked.parse(md));
  return { html: linkGlossaryTerms(boards.html, lang), hasBoard: boards.hasBoard };
}

function loadProblems(lang) {
  const dir = dirOf(lang);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => /^\d+\.md$/.test(name))
    .map(name => {
      const file = path.join(dir, name);
      const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'), `${lang}/problems/${name}`);
      return { num: Number(name.slice(0, -3)), ...data, body };
    })
    .filter(p => p.draft !== 'true')
    .sort((a, b) => a.num - b.num);
}

/** hreflang links for a page that exists in `langs` (always includes the current one). */
function hreflangLines(urlFor, langs) {
  const lines = langs.map(l => `  <link rel="alternate" hreflang="${l}" href="${urlFor(l)}">`);
  const xDefault = langs.includes('en') ? 'en' : langs[0];
  return [`  <link rel="alternate" hreflang="x-default" href="${urlFor(xDefault)}">`, ...lines].join('\n');
}

function head({ lang, title, description, url, ogType, jsonLd, depth, hasBoard, hreflang, langSwitch, image }) {
  const cfg = CFG[lang];
  const up  = '../'.repeat(depth);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="icon" href="${up}images/profile.webp" type="image/webp">
${FONT_LINKS}
  <link rel="stylesheet" href="${up}css/style.css">${hasBoard ? `
  <link rel="stylesheet" href="${up}css/shogi-player.css">` : ''}
  <link rel="canonical" href="${url}">
${hreflang}
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${esc(cfg.siteName)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${BASE_URL}${image || '/images/profile.webp'}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  </script>
</head>
<body>
${renderHeader(lang, langSwitch)}
`;
}

function foot(lang, hasBoard, depth) {
  return `
${renderFooter(lang)}${hasBoard ? `
  <script src="${'../'.repeat(depth)}js/shogi-player.js"></script>` : ''}
</body>
</html>
`;
}

function renderProblem(lang, p, prev, next, all) {
  const cfg       = CFG[lang];
  const listUrl   = listUrlOf(lang);
  const url       = `${listUrl}${p.num}/`;
  const label     = cfg.label(p.num);
  const fullTitle = `${label} ${p.title}`;

  const [questionMd, answerMd] = p.body.split(ANSWER_MARKER);
  if (answerMd === undefined) throw new Error(`${lang}/problems/${p.num}.md: "<!-- answer -->" line is missing`);
  const [statementMd, hintMd] = questionMd.split(HINT_MARKER);
  const question = renderMarkdown(statementMd, lang);
  const hint     = hintMd === undefined ? null : renderMarkdown(hintMd, lang);
  const answer   = renderMarkdown(answerMd, lang);
  const hasBoard = question.hasBoard || answer.hasBoard || Boolean(hint && hint.hasBoard);

  const langs     = LANGS.filter(l => all[l].some(q => q.num === p.num));
  const otherLang = LANGS.find(l => l !== lang);
  const langSwitch = langs.includes(otherLang) ? `/${otherLang}/problems/${p.num}/` : `/${otherLang}/problems/`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: fullTitle,
      description: p.lead,
      datePublished: p.date,
      author: { '@type': 'Person', name: cfg.author, url: `${BASE_URL}/` },
      url,
      inLanguage: lang,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: cfg.home, item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: cfg.section, item: listUrl },
        { '@type': 'ListItem', position: 3, name: label, item: url },
      ],
    },
  ];

  const navLink = (target, labelText) => target ? `
          <a href="../${target.num}/" class="btn-nav">
            <span class="btn-nav-label">${labelText}</span>
            <span class="btn-nav-title">${cfg.label(target.num)} ${esc(target.title)}</span>
          </a>` : '';

  return head({
    lang, title: `${fullTitle} | ${cfg.siteName}`, description: p.lead, url, ogType: 'article', jsonLd, depth: 3, hasBoard,
    hreflang: hreflangLines(l => `${listUrlOf(l)}${p.num}/`, langs), langSwitch, image: thumbOf(lang, p.num),
  }) + `
  <main>
    <div class="container">

      <nav class="breadcrumb">
        <a href="/">${cfg.home}</a>
        <span class="breadcrumb-sep">/</span>
        <a href="../">${cfg.section}</a>
        <span class="breadcrumb-sep">/</span>
        <span>${label}</span>
      </nav>

      <article>
        <header class="article-header">
          <div class="article-meta">
            <span class="article-category">${cfg.section}</span>
            <span>${esc(p.level)}</span>${p.strategy ? `
            <span>${esc(p.strategy)}</span>` : ''}${p.tag ? `
            <span>${esc(p.tag)}</span>` : ''}
            <span>${esc(p.date)}</span>
          </div>
          <p class="problem-number">${label}</p>
          <h1 class="article-title">${esc(p.title)}</h1>
        </header>

        <div class="article-body">
${question.html}${hint ? `
          <details class="problem-answer problem-hint">
            <summary>${cfg.showHint}</summary>
            <div class="problem-answer-body">
${hint.html}
            </div>
          </details>` : ''}
          <details class="problem-answer">
            <summary>${cfg.showAnswer}</summary>
            <div class="problem-answer-body">
${answer.html}
            </div>
          </details>
        </div>

        <footer class="article-footer">
          <a href="../" class="btn-ghost">${cfg.backToList}</a>${navLink(prev, cfg.prev)}${navLink(next, cfg.next)}
        </footer>
      </article>

    </div>
  </main>
` + foot(lang, hasBoard, 3);
}

const rank = (order, value) => {
  const i = order.indexOf(value);
  return i < 0 ? order.length : i;
};

/**
 * List filter. Without JavaScript the filter bar stays hidden and every problem
 * is shown. The selection is kept in the URL (?level=…&type=…&tag=…) so it can be shared.
 */
const FILTER_SCRIPT = `
(function () {
  var bar = document.querySelector('.problem-filter');
  if (!bar) return;
  var cards = document.querySelectorAll('.course-cards > .course-card');
  var empty = document.querySelector('.problem-filter-empty');
  var params = new URLSearchParams(location.search);
  var state = { level: params.get('level') || '', type: params.get('type') || '', tag: params.get('tag') || '' };
  // Ignore values in the URL that no chip offers (e.g. an old link).
  Object.keys(state).forEach(function (key) {
    var known = Array.prototype.some.call(bar.querySelectorAll('.problem-filter-chip'), function (chip) {
      return chip.dataset.filter === key && chip.dataset.value === state[key];
    });
    if (!known) state[key] = '';
  });
  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var ok = (!state.level || card.dataset.level === state.level) &&
               (!state.type || card.dataset.type === state.type) &&
               (!state.tag || card.dataset.tag === state.tag);
      card.hidden = !ok;
      if (ok) shown++;
    });
    empty.hidden = shown > 0;
    bar.querySelectorAll('.problem-filter-chip').forEach(function (chip) {
      chip.setAttribute('aria-pressed', String(state[chip.dataset.filter] === chip.dataset.value));
    });
  }
  bar.addEventListener('click', function (e) {
    var chip = e.target.closest('.problem-filter-chip');
    if (!chip) return;
    state[chip.dataset.filter] = chip.dataset.value;
    var q = new URLSearchParams();
    if (state.level) q.set('level', state.level);
    if (state.type) q.set('type', state.type);
    if (state.tag) q.set('tag', state.tag);
    var qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    apply();
  });
  bar.hidden = false;
  apply();
})();
`;

function renderList(lang, problems) {
  const cfg       = CFG[lang];
  const listUrl   = listUrlOf(lang);
  const listTitle = `${cfg.section} | ${cfg.siteName}`;
  const otherLang = LANGS.find(l => l !== lang);
  const newestFirst = [...problems].reverse();

  const cards = problems.length === 0
    ? `          <p style="color:var(--color-text-muted);">${cfg.empty}</p>`
    : newestFirst.map(p => {
        const thumb = thumbOf(lang, p.num);
        const lead  = thumb
          ? `<img class="problem-card-thumb" src="${thumb}" alt="${esc(cfg.label(p.num))}" width="640" height="527" loading="lazy">`
          : `<div class="course-card-num">${p.num}</div>`;
        return `            <a href="${p.num}/" class="course-card${thumb ? ' problem-card' : ''}" data-level="${esc(p.level)}" data-type="${p.type}" data-tag="${esc(p.tag || '')}">
              ${lead}
              <div class="course-card-body">${thumb ? `
                <p class="problem-number">${cfg.label(p.num)}</p>` : ''}
                <p class="course-card-title">${esc(p.title)}</p>
                <p class="course-card-desc">${esc(p.lead)}</p>
              </div>
              <span class="course-card-arrow">›</span>
            </a>`;
      }).join('\n');

  // Filter chips: only levels and types that appear in the list, in a fixed order.
  const used   = key => new Set(problems.map(p => p[key]));
  const levels = [...used('level')].sort((a, b) => rank(cfg.levelOrder, a) - rank(cfg.levelOrder, b));
  const types  = Object.keys(cfg.types).filter(t => used('type').has(t));
  const tags   = [...used('tag')].filter(Boolean).sort();
  const chips  = (group, label, items) => `
          <div class="problem-filter-group" role="group" aria-label="${label}">
            <span class="problem-filter-label">${label}</span>
            <button type="button" class="problem-filter-chip" data-filter="${group}" data-value="" aria-pressed="true">${cfg.filterAll}</button>${items.map(([value, text]) => `
            <button type="button" class="problem-filter-chip" data-filter="${group}" data-value="${esc(value)}" aria-pressed="false">${esc(text)}</button>`).join('')}
          </div>`;
  const filters = problems.length < 2 ? '' : `
        <div class="problem-filter" hidden>${chips('level', cfg.filterLevel, levels.map(l => [l, l]))}${chips('type', cfg.filterType, types.map(t => [t, cfg.types[t]]))}${tags.length ? chips('tag', cfg.filterTag, tags.map(t => [t, t])) : ''}
        </div>
        <p class="problem-filter-empty" hidden>${cfg.noMatch}</p>`;

  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listTitle,
    itemListElement: newestFirst.map((p, i) => ({
      '@type': 'ListItem', position: i + 1, url: `${listUrl}${p.num}/`,
    })),
  }];

  return head({
    lang, title: listTitle, description: cfg.listDesc, url: listUrl, ogType: 'website', jsonLd, depth: 2, hasBoard: false,
    hreflang: hreflangLines(listUrlOf, LANGS), langSwitch: `/${otherLang}/problems/`,
  }) + `
  <main>
    <section class="hero" style="padding: 3.5rem 0;">
      <div class="container">
        <h1 class="hero-title">${cfg.section}</h1>
        <p class="hero-subtitle">${cfg.listSubtitle}</p>
        <p class="hero-subtitle">${cfg.listNote}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="course-intro">${filters}
          <div class="course-cards">
${cards}
          </div>
        </div>
      </div>
    </section>
  </main>${filters ? `
  <script>${FILTER_SCRIPT}</script>` : ''}
` + foot(lang, false, 2);
}

function build() {
  const all = Object.fromEntries(LANGS.map(l => [l, loadProblems(l)]));

  for (const lang of LANGS) {
    const dir      = dirOf(lang);
    const problems = all[lang];
    const keep     = new Set(problems.map(p => String(p.num)));

    // Remove pages of problems that were deleted or turned back into drafts.
    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && /^\d+$/.test(entry.name) && !keep.has(entry.name)) {
          fs.rmSync(path.join(dir, entry.name), { recursive: true });
        }
      }
    }

    problems.forEach((p, i) => {
      const outDir = path.join(dir, String(p.num));
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'index.html'), renderProblem(lang, p, problems[i - 1], problems[i + 1], all));
    });

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderList(lang, problems));
    console.log(`[${lang}] Generated ${problems.length} problem page(s) and ${lang}/problems/index.html`);
  }
}

build();
