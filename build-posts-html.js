#!/usr/bin/env node
/**
 * build-posts-html.js
 *
 * Generates a static index.html for each blog post.
 * Output: {lang}/blog/posts/{slug}/index.html
 *
 * Must run after build-posts-json.js (reads posts.json).
 *
 * Usage:
 *   node build-posts-html.js          # both en and ja
 *   node build-posts-html.js en       # en only
 *   node build-posts-html.js ja       # ja only
 */

const fs   = require('fs');
const path = require('path');
const { marked } = require('marked');
const { linkGlossaryTerms } = require('./lib/glossary-links');

const BASE_URL = 'https://shogi.saiba-zakki.com';
const GA_ID    = 'G-3QWHMZKB7V';

// Per-language UI strings and nav structure.
// All relative paths are from {lang}/blog/posts/{slug}/index.html:
//   ../    = {lang}/blog/posts/
//   ../../  = {lang}/blog/
//   ../../../  = {lang}/
//   ../../../../ = site root
const CFG = {
  en: {
    htmlLang:       'en',
    siteName:       "Saiba's Shogi Portal",
    authorName:     'Saiba',
    byLine:         'By Saiba',
    backToBlog:     '← Back to Blog',
    newerLabel:     '← Newer',
    olderLabel:     'Older →',
    breadHome:      'Home',
    breadBlog:      'Blog',
    affiliateNotice:'This page may contain affiliate links through the Amazon Associates program.',
    footerBack:     'Back to top',
    backToTopAria:  'Back to top',
    otherLang:      'ja',
    otherLangLabel: 'JA',
    navLinks: [
      ['../../../',          'Books'],
      ['../../',             'Blog'],
      ['../../../guide/',    'Guide'],
      ['../../../castles/',  'Castles'],
      ['../../../glossary/', 'Glossary'],
    ],
    authorBio:
      'Amateur 3-dan Shogi player, IT engineer in Japan. Author of beginner-focused Shogi Kindle books in Japanese and English. → ' +
      '<a href="../../../" class="books-link">See published books</a><br>\n' +
      '              Mail:\n' +
      '              <span class="obfuscated-email">saiba.contact.books [at] gmail [dot] com</span>\n' +
      '              <button type="button" class="copy-email-btn"' +
      ' data-email-user="saiba.contact.books" data-email-domain="gmail.com"' +
      ' data-copy-default="Copy" data-copy-done="Copied!">Copy</button>\n' +
      '              (Please feel free to contact for impressions, requests, reports of typos, etc.)<br>\n' +
      '              Note: Please understand that I may not be able to reply to all emails.',
    xShareSuffix:     "| Saiba's Shogi Portal",
    xShareLabel:      'Share on X',
    blogPageTitle:    "Blog | Saiba's Shogi Portal",
    blogDescription:  "Shogi columns, tips, and thoughts from Saiba — helping beginners enjoy the game.",
    blogHeroTitle:    'Blog',
    blogHeroSubtitle: 'Shogi columns, tips, and thoughts to help you enjoy and improve at the game.',
    blogEmptyMessage: 'No posts yet.',
    blogReadMore:     'Read more',
  },
  ja: {
    htmlLang:       'ja',
    siteName:       'さいばの将棋ポータル',
    authorName:     'さいば',
    byLine:         '著者：さいば',
    backToBlog:     '← ブログ一覧へ',
    newerLabel:     '← 新しい記事',
    olderLabel:     '古い記事 →',
    breadHome:      'ホーム',
    breadBlog:      'ブログ',
    affiliateNotice:'本ページにはAmazonアソシエイトプログラムを利用した広告リンクが含まれている場合があります。',
    footerBack:     'トップへ戻る',
    backToTopAria:  'ページ上部へ戻る',
    otherLang:      'en',
    otherLangLabel: 'EN',
    navLinks: [
      ['../../../',          '本の紹介'],
      ['../../',             'ブログ'],
      ['../../../guide/',    '入門ガイド'],
      ['../../../castles/',  '囲い'],
      ['../../../glossary/', '用語集'],
    ],
    authorBio:
      '将棋ウォーズを中心に将棋を楽しむアマチュア三段。初心者～級位者向けの将棋Kindle本の執筆活動を行っている。→ ' +
      '<a href="../../../" class="books-link">執筆した本はこちら</a><br>\n' +
      '              Note: <a href="https://note.com/saibaba81" target="_blank" rel="noopener">https://note.com/saibaba81</a>',
    xShareSuffix:     '| さいばの将棋ポータル',
    xShareLabel:      'この記事をXでシェア',
    blogPageTitle:    'ブログ | さいばの将棋ポータル',
    blogDescription:  'さいばによる将棋コラム・上達のヒントなどをお届けするブログです。',
    blogHeroTitle:    'ブログ',
    blogHeroSubtitle: '将棋に関するコラム・上達のヒントなどをお届けします。',
    blogEmptyMessage: '記事はまだありません。',
    blogReadMore:     '続きを読む',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescHtml(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'");
}

/**
 * Replace <pre><code class="language-linkcard">…</code></pre> blocks
 * with rendered link-card HTML, matching the browser's processLinkCards().
 */
function processLinkCards(html) {
  return html.replace(
    /<pre><code class="language-linkcard">([\s\S]*?)<\/code><\/pre>/g,
    (_, raw) => {
      const text = unescHtml(raw);
      const data = {};
      text.trim().split('\n').forEach(line => {
        const i = line.indexOf(':');
        if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
      if (!data.url) return raw;

      let hostname;
      try { hostname = new URL(data.url).hostname; } catch (_) { hostname = data.url; }

      const thumbHtml = data.image
        ? `<div class="link-card-thumb"><img src="${esc(data.image)}" alt="${esc(data.title || '')}" loading="lazy"></div>`
        : '';
      return `<a href="${esc(data.url)}" target="_blank" rel="noopener noreferrer" class="link-card">
  ${thumbHtml}
  <div class="link-card-body">
    <p class="link-card-title">${esc(data.title || data.url)}</p>
    ${data.desc ? `<p class="link-card-desc">${esc(data.desc)}</p>` : ''}
    <p class="link-card-host">${esc(hostname)}</p>
  </div>
</a>`;
    }
  );
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function renderPage({
  cfg, post, plainTitle, postUrl,
  ogImage, twitterCard,
  hreflangLines, jsonLd,
  contentHtml, thumbHtml,
  xShareBtn, prevNextHtml,
  langLink,
}) {
  const navHtml = cfg.navLinks
    .map(([href, label]) => `        <a href="${href}">${label}</a>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${cfg.htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(plainTitle)} | ${cfg.breadBlog} | ${esc(cfg.siteName)}</title>
  <meta name="description" content="${esc(post.lead)}">
  <link rel="icon" href="../../../../images/profile.webp" type="image/webp">
  <link rel="stylesheet" href="../../../../css/style.css">
  <link rel="canonical" href="${postUrl}">
${hreflangLines}
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${esc(cfg.siteName)}">
  <meta property="og:title" content="${esc(plainTitle)}">
  <meta property="og:description" content="${esc(post.lead)}">
  <meta property="og:url" content="${postUrl}">
  <meta property="og:image" content="${ogImage}">
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${esc(plainTitle)}">
  <meta name="twitter:description" content="${esc(post.lead)}">
  <script type="application/ld+json">
${jsonLd}
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
  <header class="site-header">
    <div class="container">
      <a href="../../../../" class="site-logo">${esc(cfg.siteName)}</a>
      <nav class="site-nav">
${navHtml}
        <a href="${langLink}" class="lang-switch">${cfg.otherLangLabel}</a>
      </nav>
    </div>
  </header>

  <main>
    <div class="container">

      <nav class="breadcrumb">
        <a href="../../../../">${cfg.breadHome}</a>
        <span class="breadcrumb-sep">/</span>
        <a href="../../">${cfg.breadBlog}</a>
        <span class="breadcrumb-sep">/</span>
        <span>${esc(plainTitle)}</span>
      </nav>

      <article>
        <header class="article-header">
          <div class="article-meta">
            <span class="article-category">${esc(post.category)}</span>
            <span>${esc(post.date)}</span>
            <span>${cfg.byLine}</span>
          </div>
          <h1 class="article-title">${post.titleHtml}</h1>
          <p class="article-lead">${esc(post.lead)}</p>
        </header>
${thumbHtml}
        <div class="article-body">
${contentHtml}
        </div>

        <div class="article-share">
          ${xShareBtn}
        </div>

        <footer class="article-footer">
          <a href="../../" class="btn-ghost">${cfg.backToBlog}</a>${prevNextHtml}
        </footer>
      </article>

      <section class="section">
        <div class="author-box">
          <div class="author-avatar">
            <img src="../../../../images/profile.webp" alt="${esc(cfg.authorName)} icon">
          </div>
          <div>
            <p class="author-name">${esc(cfg.authorName)}</p>
            <p class="author-bio">
              ${cfg.authorBio}
            </p>
          </div>
        </div>
      </section>

    </div>
  </main>

  <button class="back-to-top" aria-label="${cfg.backToTopAria}">
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 14V4M4 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <footer class="site-footer">
    <div class="container">
      <p class="affiliate-notice">${cfg.affiliateNotice}</p>
      <p>&copy; <span id="copy-year"></span> shogi.saiba-zakki.com &nbsp;|&nbsp; <a href="../../../../">${cfg.footerBack}</a></p>
    </div>
  </footer>

  <script>
    document.getElementById('copy-year').textContent = new Date().getFullYear();

    document.querySelectorAll('.copy-email-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var user   = btn.dataset.emailUser   || '';
        var domain = btn.dataset.emailDomain || '';
        if (!user || !domain) return;
        var email        = user + '@' + domain;
        var defaultLabel = btn.dataset.copyDefault || 'Copy';
        var doneLabel    = btn.dataset.copyDone    || 'Copied!';
        try {
          await navigator.clipboard.writeText(email);
        } catch (_) {
          var temp = document.createElement('textarea');
          temp.value = email;
          temp.setAttribute('readonly', '');
          temp.style.position = 'absolute';
          temp.style.left = '-9999px';
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.remove();
        }
        btn.textContent = doneLabel;
        setTimeout(function() { btn.textContent = defaultLabel; }, 1600);
      });
    });

    var backToTop = document.querySelector('.back-to-top');
    window.addEventListener('scroll', function() {
      backToTop.classList.toggle('is-visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  </script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Blog index (listing page)
// ---------------------------------------------------------------------------

function renderBlogIndex({ cfg, lang, posts }) {
  const pageUrl  = `${BASE_URL}/${lang}/blog/`;
  const otherLang = cfg.otherLang;

  // Nav links from {lang}/blog/index.html (2 levels deep from root).
  // Labels are taken from cfg.navLinks; paths are recomputed for this depth.
  const blogNavPaths = ['../', './', '../guide/', '../castles/', '../glossary/'];
  const navHtml = cfg.navLinks
    .map(([, label], i) => `        <a href="${blogNavPaths[i]}">${label}</a>`)
    .join('\n');

  const cardHtml = posts.length === 0
    ? `        <p style="color:var(--color-text-muted);">${cfg.blogEmptyMessage}</p>`
    : posts.map(post => {
        const thumbHtml = post.thumbnail
          ? `<div class="post-card-thumb"><img src="${esc(post.thumbnail)}" alt="${esc(post.title)}" loading="lazy"></div>`
          : '';
        const bodyClass = post.thumbnail ? 'post-card-body' : '';
        return `        <a href="posts/${post.slug}/" class="post-card${post.thumbnail ? ' has-thumb' : ''}">
          ${thumbHtml}
          <div class="${bodyClass}">
            <div class="post-card-meta">
              <span class="post-card-category">${esc(post.category)}</span>
              <span>${esc(post.date)}</span>
            </div>
            <p class="post-card-title">${post.title}</p>
            <p class="post-card-excerpt">${esc(post.lead)}</p>
            <span class="post-card-readmore">${cfg.blogReadMore}</span>
          </div>
        </a>`;
      }).join('\n');

  const jsonLd = JSON.stringify([
    {
      '@context':   'https://schema.org',
      '@type':      'Blog',
      name:         cfg.blogPageTitle,
      url:          pageUrl,
      description:  cfg.blogDescription,
      inLanguage:   lang,
      author:       { '@type': 'Person', name: cfg.authorName, url: `${BASE_URL}/` },
    },
    {
      '@context': 'https://schema.org',
      '@type':    'ItemList',
      itemListElement: posts.map((post, i) => ({
        '@type':   'ListItem',
        position:  i + 1,
        url:       `${BASE_URL}/${lang}/blog/posts/${post.slug}/`,
      })),
    },
  ], null, 2);

  return `<!DOCTYPE html>
<html lang="${cfg.htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(cfg.blogPageTitle)}</title>
  <meta name="description" content="${esc(cfg.blogDescription)}">
  <link rel="icon" href="../../images/profile.webp" type="image/webp">
  <link rel="stylesheet" href="../../css/style.css">
  <link rel="canonical" href="${pageUrl}">
  <link rel="alternate" hreflang="x-default" href="${BASE_URL}/en/blog/">
  <link rel="alternate" hreflang="en"        href="${BASE_URL}/en/blog/">
  <link rel="alternate" hreflang="ja"        href="${BASE_URL}/ja/blog/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(cfg.siteName)}">
  <meta property="og:title" content="${esc(cfg.blogPageTitle)}">
  <meta property="og:description" content="${esc(cfg.blogDescription)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${BASE_URL}/images/profile.webp">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(cfg.blogPageTitle)}">
  <meta name="twitter:description" content="${esc(cfg.blogDescription)}">
  <script type="application/ld+json">
${jsonLd}
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
  <header class="site-header">
    <div class="container">
      <a href="../../" class="site-logo">${esc(cfg.siteName)}</a>
      <nav class="site-nav">
${navHtml}
        <a href="../../${otherLang}/blog/" class="lang-switch">${cfg.otherLangLabel}</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero" style="padding: 3.5rem 0;">
      <div class="container">
        <h1 class="hero-title">${cfg.blogHeroTitle}</h1>
        <p class="hero-subtitle">${cfg.blogHeroSubtitle}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="post-list">
${cardHtml}
        </div>
      </div>
    </section>
  </main>

  <button class="back-to-top" aria-label="${cfg.backToTopAria}">
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 14V4M4 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <footer class="site-footer">
    <div class="container">
      <p>&copy; <span id="copy-year"></span> shogi.saiba-zakki.com &nbsp;|&nbsp; <a href="../../">${cfg.footerBack}</a></p>
    </div>
  </footer>

  <script>
    document.getElementById('copy-year').textContent = new Date().getFullYear();

    var backToTop = document.querySelector('.back-to-top');
    window.addEventListener('scroll', function() {
      backToTop.classList.toggle('is-visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  </script>
</body>
</html>
`;
}

function buildBlogIndex(lang, allPosts) {
  const cfg      = CFG[lang];
  const jsonFile = path.join(__dirname, lang, 'blog', 'posts.json');

  if (!fs.existsSync(jsonFile)) {
    console.error(`[${lang}] posts.json not found — run build-posts-json.js first`);
    return;
  }

  const posts = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  const html    = renderBlogIndex({ cfg, lang, posts });
  const outFile = path.join(__dirname, lang, 'blog', 'index.html');
  fs.writeFileSync(outFile, html, 'utf8');
  console.log(`[${lang}] Generated ${lang}/blog/index.html (${posts.length} post(s))`);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function buildForLang(lang, allPosts) {
  const cfg       = CFG[lang];
  const otherLang = cfg.otherLang;
  const otherPosts = allPosts[otherLang] || [];

  const postsDir = path.join(__dirname, lang, 'blog', 'posts');
  const jsonFile = path.join(__dirname, lang, 'blog', 'posts.json');

  if (!fs.existsSync(jsonFile)) {
    console.error(`[${lang}] posts.json not found — run build-posts-json.js first`);
    return;
  }

  const posts = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  let count = 0;

  for (let i = 0; i < posts.length; i++) {
    const post  = posts[i];
    const newer = posts[i - 1] || null; // newer = previous in sorted-desc order
    const older = posts[i + 1] || null;

    const mdFile = path.join(postsDir, post.slug + '.md');
    if (!fs.existsSync(mdFile)) {
      console.warn(`[${lang}] .md file not found for slug "${post.slug}" — skipped`);
      continue;
    }

    // Markdown → HTML
    const mdContent = fs.readFileSync(mdFile, 'utf8');
    const mdBody    = mdContent.replace(/^---[\s\S]*?---\n?/, '');
    let contentHtml = marked.parse(mdBody);
    contentHtml     = processLinkCards(contentHtml);
    contentHtml     = linkGlossaryTerms(contentHtml, lang);

    const postUrl    = `${BASE_URL}/${lang}/blog/posts/${post.slug}/`;
    const plainTitle = post.title.replace(/<br>/g, ' ');

    // hreflang
    const hasOtherLang  = otherPosts.some(p => p.slug === post.slug);
    const otherLangUrl  = hasOtherLang
      ? `${BASE_URL}/${otherLang}/blog/posts/${post.slug}/`
      : `${BASE_URL}/${otherLang}/blog/`;

    let hreflangLines;
    if (lang === 'en') {
      hreflangLines = [
        `  <link rel="alternate" hreflang="x-default" href="${postUrl}">`,
        `  <link rel="alternate" hreflang="en"        href="${postUrl}">`,
        hasOtherLang ? `  <link rel="alternate" hreflang="ja"        href="${otherLangUrl}">` : '',
      ].filter(Boolean).join('\n');
    } else {
      const xDefault = hasOtherLang ? otherLangUrl : postUrl;
      hreflangLines = [
        `  <link rel="alternate" hreflang="x-default" href="${xDefault}">`,
        hasOtherLang ? `  <link rel="alternate" hreflang="en"        href="${otherLangUrl}">` : '',
        `  <link rel="alternate" hreflang="ja"        href="${postUrl}">`,
      ].filter(Boolean).join('\n');
    }

    // OGP image
    const ogImage = post.thumbnail
      ? (post.thumbnail.startsWith('http') ? post.thumbnail : `${BASE_URL}${post.thumbnail}`)
      : `${BASE_URL}/images/profile.webp`;
    const twitterCard = post.thumbnail ? 'summary_large_image' : 'summary';

    // JSON-LD
    const jsonLd = JSON.stringify([
      {
        '@context':        'https://schema.org',
        '@type':           'BlogPosting',
        headline:          plainTitle,
        description:       post.lead,
        datePublished:     post.date,
        author:            { '@type': 'Person', name: cfg.authorName, url: `${BASE_URL}/` },
        publisher:         { '@type': 'Person', name: cfg.authorName },
        url:               postUrl,
        inLanguage:        lang,
        mainEntityOfPage:  { '@type': 'WebPage', '@id': postUrl },
      },
      {
        '@context': 'https://schema.org',
        '@type':    'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: cfg.breadHome, item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: cfg.breadBlog, item: `${BASE_URL}/${lang}/blog/` },
          { '@type': 'ListItem', position: 3, name: plainTitle,    item: postUrl },
        ],
      },
    ], null, 2);

    // X share button
    const shareText  = encodeURIComponent(`${post.title} ${cfg.xShareSuffix}`);
    const shareUrlEnc = encodeURIComponent(postUrl);
    const xShareBtn  = `<a class="btn-x-share" href="https://x.com/intent/post?text=${shareText}&url=${shareUrlEnc}" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 1200 1227" fill="currentColor" aria-hidden="true"><path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026Z"/></svg>
            ${cfg.xShareLabel}
          </a>`;

    // Prev / next navigation
    let prevNextHtml = '';
    if (newer) {
      prevNextHtml += `
          <a href="../${newer.slug}/" class="btn-nav">
            <span class="btn-nav-label">${cfg.newerLabel}</span>
            <span class="btn-nav-title">${esc(newer.title)}</span>
          </a>`;
    }
    if (older) {
      prevNextHtml += `
          <a href="../${older.slug}/" class="btn-nav">
            <span class="btn-nav-label">${cfg.olderLabel}</span>
            <span class="btn-nav-title">${esc(older.title)}</span>
          </a>`;
    }

    // Thumbnail
    const thumbHtml = post.thumbnail
      ? `\n        <figure class="article-thumb">\n          <img src="${esc(post.thumbnail)}" alt="${esc(plainTitle)}">\n        </figure>`
      : '';

    // Language switcher link
    const langLink = hasOtherLang
      ? `../../../../${otherLang}/blog/posts/${post.slug}/`
      : `../../../../${otherLang}/blog/`;

    // Render and write
    const html    = renderPage({ cfg, post, plainTitle, postUrl, ogImage, twitterCard, hreflangLines, jsonLd, contentHtml, thumbHtml, xShareBtn, prevNextHtml, langLink });
    const outDir  = path.join(postsDir, post.slug);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    count++;
  }

  console.log(`[${lang}] Generated ${count} static post HTML file(s)`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const target = process.argv[2];
const langs  = (!target || target === 'en') ? ['en'] : [];
if (!target || target === 'ja') langs.push('ja');
if (target === 'en') langs.length = 0, langs.push('en');

// Pre-load all posts.json so each lang can check the other lang's slugs
const allPosts = {};
for (const l of ['en', 'ja']) {
  const f = path.join(__dirname, l, 'blog', 'posts.json');
  allPosts[l] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
}

const buildLangs = target ? [target] : ['en', 'ja'];
for (const l of buildLangs) {
  buildForLang(l, allPosts);
  buildBlogIndex(l, allPosts);
}
