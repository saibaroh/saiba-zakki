/**
 * lib/templates.js
 *
 * Shared header/footer HTML templates.
 * All internal links use root-relative paths (/en/, /ja/, etc.)
 * so the same template works regardless of page depth.
 */

const LANG = {
  en: {
    siteName:       "Saiba's Shogi Portal",
    navItems: [
      ['/en/',          'Books'],
      ['/en/blog/',     'Blog'],
      ['/en/guide/',    'Guide'],
      ['/en/castles/',  'Castles'],
      ['/en/glossary/', 'Glossary'],
    ],
    otherLangLabel: 'JA',
    backToTopAria:  'Back to top',
    footerBack:     'Back to top',
    affiliateNotice: 'This page may contain affiliate links through the Amazon Associates program.',
  },
  ja: {
    siteName:       'さいばの将棋ポータル',
    navItems: [
      ['/ja/',          '本の紹介'],
      ['/ja/blog/',     'ブログ'],
      ['/ja/guide/',    '入門ガイド'],
      ['/ja/castles/',  '囲い'],
      ['/ja/glossary/', '用語集'],
    ],
    otherLangLabel: 'EN',
    backToTopAria:  'ページ上部へ戻る',
    footerBack:     'トップへ戻る',
    affiliateNotice: '本ページにはAmazonアソシエイトプログラムを利用した広告リンクが含まれている場合があります。',
  },
};

/**
 * Render the site <header> navigation bar.
 * Active nav link is detected at runtime via JS (longest URL prefix match).
 *
 * @param {string} lang            - 'en' | 'ja'
 * @param {string} langswitchHref  - root-relative href for the language toggle link
 */
function renderHeader(lang, langswitchHref) {
  const cfg = LANG[lang];
  const navItems = cfg.navItems
    .map(([href, label]) => `        <a href="${href}">${label}</a>`)
    .join('\n');

  return `  <header class="site-header">
    <div class="container">
      <a href="/" class="site-logo">${cfg.siteName}</a>
      <nav class="site-nav">
${navItems}
        <a href="${langswitchHref}" class="lang-switch">${cfg.otherLangLabel}</a>
      </nav>
    </div>
  </header>
  <script>
    (function () {
      var path = location.pathname;
      var best = null, bestLen = 0;
      document.querySelectorAll('.site-nav a:not(.lang-switch)').forEach(function (a) {
        try {
          var lp = new URL(a.href).pathname;
          if (lp.length > bestLen && path.startsWith(lp)) { best = a; bestLen = lp.length; }
        } catch (e) {}
      });
      if (best) { best.classList.add('is-current'); best.setAttribute('aria-current', 'page'); }
    })();
  </script>`;
}

/**
 * Render the back-to-top button, site <footer>, and supporting JS.
 *
 * @param {string}  lang                - 'en' | 'ja'
 * @param {object}  [opts]
 * @param {boolean} [opts.affiliate]    - include affiliate notice
 */
function renderFooter(lang, { affiliate = false } = {}) {
  const cfg = LANG[lang];
  const affiliateHtml = affiliate
    ? `      <p class="affiliate-notice">${cfg.affiliateNotice}</p>\n`
    : '';

  return `  <button class="back-to-top" aria-label="${cfg.backToTopAria}">
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 14V4M4 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <footer class="site-footer">
    <div class="container">
${affiliateHtml}      <p>&copy; <span id="copy-year"></span> shogi.saiba-zakki.com &nbsp;|&nbsp; <a href="/">${cfg.footerBack}</a></p>
    </div>
  </footer>

  <script>
    (function () {
      document.getElementById('copy-year').textContent = new Date().getFullYear();
      var b = document.querySelector('.back-to-top');
      if (b) {
        window.addEventListener('scroll', function () {
          b.classList.toggle('is-visible', window.scrollY > 400);
        }, { passive: true });
        b.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    })();
  </script>`;
}

module.exports = { renderHeader, renderFooter };
