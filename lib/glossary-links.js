/**
 * lib/glossary-links.js
 *
 * Glossary term definitions and HTML auto-linking utility.
 *
 * Usage:
 *   const { linkGlossaryTerms } = require('./lib/glossary-links');
 *   const html = linkGlossaryTerms(rawHtml, 'en');
 */

const EN_GLOSSARY = '/en/glossary/';
const JA_GLOSSARY = '/ja/glossary/';

// ---------------------------------------------------------------------------
// Term maps  [surface text, anchor id]
// Longer terms must come before shorter ones that overlap.
// ---------------------------------------------------------------------------

const EN_TERMS = [
  // Compound / multi-word terms first
  ['piece development',     'piece-development'],
  ['dual-purpose move',     'dual-purpose-move'],
  ['endgame attack',        'endgame-attack'],
  ['interposing piece',     'interposing-piece'],
  ['piece exchange',        'piece-exchange'],
  ['material gain',         'material-gain'],
  ['material loss',         'material-gain'],
  ['major pieces',          'major-pieces'],
  ['minor pieces',          'minor-pieces'],
  ['idle pieces',           'idle-piece'],
  ['Ranging Rook',          'static-ranging-rook'],
  ['Static Rook',           'static-ranging-rook'],
  ['double attack',         'fork'],
  // Single-word terms
  ['major piece',           'major-pieces'],
  ['minor piece',           'minor-pieces'],
  ['idle piece',            'idle-piece'],
  ['castle',                'castle'],
  ['threatmate',            'threatmate'],
  ['brinkmate',             'brinkmate'],
  ['tesuji',                'tesuji'],
  ['kobin',                 'kobin'],
];

// Sorted longest-first so longer matches win over shorter sub-strings
const JA_TERMS = [
  ['飛車先の歩交換',         '飛車先の歩交換'],
  ['相居飛車',              '相居飛車・相振り飛車・対抗形'],
  ['相振り飛車',            '相居飛車・相振り飛車・対抗形'],
  ['大駒を切る',            '大駒を切る'],
  ['遊び駒',                '遊び駒'],
  ['攻防手',                '攻防手'],
  ['両取り',                '両取り'],
  ['詰めろ',                '詰めろ'],
  ['駒得',                  '駒得'],
  ['駒損',                  '駒得'],
  ['駒組',                  '駒組'],
  ['合駒',                  '合駒'],
  ['入玉',                  '入玉'],
  ['居飛車',                '居飛車・振り飛車'],
  ['振り飛車',              '居飛車・振り飛車'],
  ['大駒',                  '大駒'],
  ['小駒',                  '小駒'],
  ['必至',                  '必至'],
  ['手筋',                  '手筋'],
  ['囲い',                  '囲い'],
  ['寄せ',                  '寄せ'],
  ['受け',                  '受け'],
  ['居玉',                  '居玉'],
];

// HTML tags whose text content we never process
const SKIP_TAGS = new Set([
  'a', 'script', 'style', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'nav', 'header', 'footer',
]);

// HTML void elements (never have closing tags)
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Collect terms that are already linked to the glossary in this HTML
 * (identified by href pointing to the glossary page).
 * Returns a Set of lowercased link-text values.
 */
function collectLinkedTerms(html, glossaryBase) {
  const linked = new Set();
  const re = new RegExp(
    `href="${escapeRegex(glossaryBase)}[^"]*"[^>]*>([^<]+)<\\/a>`,
    'gi'
  );
  let m;
  while ((m = re.exec(html)) !== null) {
    linked.add(m[1].trim().toLowerCase());
  }
  return linked;
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

/**
 * Walk HTML as a token stream (tags vs text) and apply glossary links
 * to text nodes that are not inside skip tags.
 *
 * Uses a single combined-regex pass per text node to avoid matching
 * inside href attributes of newly inserted <a> tags.
 *
 * @param {string}   html        - HTML content to process
 * @param {string}   lang        - 'en' | 'ja'
 * @returns {string}             - HTML with glossary links inserted
 */
function linkGlossaryTerms(html, lang) {
  const terms       = lang === 'en' ? EN_TERMS   : JA_TERMS;
  const glossaryUrl = lang === 'en' ? EN_GLOSSARY : JA_GLOSSARY;
  const isJaLang    = lang === 'ja';

  // Collect terms already linked — skip them to ensure idempotency
  const alreadyLinked = collectLinkedTerms(html, glossaryUrl);

  // Which terms remain to be linked (first occurrence only)
  const pending = terms.filter(([t]) => !alreadyLinked.has(t.toLowerCase()));
  if (pending.length === 0) return html;

  // Build href lookup: lowercased term -> href
  const hrefMap = new Map(
    pending.map(([term, anchor]) => [term.toLowerCase(), glossaryUrl + '#' + anchor])
  );

  // Build a single combined regex (terms already ordered longest-first)
  // This ensures longer terms win over overlapping shorter ones.
  const escapedTerms = pending.map(([term]) => escapeRegex(term));
  const combined = isJaLang
    ? new RegExp(`(${escapedTerms.join('|')})`, 'g')
    : new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');

  // Track which terms have been linked so far in this pass
  const linkedThisPass = new Set(alreadyLinked);

  // Split HTML into alternating text / tag segments
  const parts   = html.split(/(<[^>]+>)/gs);
  const tagStack = [];
  const result  = [];

  for (const part of parts) {
    if (part.startsWith('<')) {
      // ── Tag token ──
      const closeTag = part.match(/^<\/(\w+)/i);
      const openTag  = part.match(/^<(\w+)/i);
      if (closeTag) {
        const tag = closeTag[1].toLowerCase();
        const idx = tagStack.lastIndexOf(tag);
        if (idx !== -1) tagStack.splice(idx, 1);
      } else if (openTag) {
        const tag = openTag[1].toLowerCase();
        if (!part.endsWith('/>') && !VOID_TAGS.has(tag)) {
          tagStack.push(tag);
        }
      }
      result.push(part);
    } else {
      // ── Text token ──
      const skip = tagStack.some(t => SKIP_TAGS.has(t));
      if (skip || part.trim() === '') {
        result.push(part);
        continue;
      }

      // Single-pass replacement: reset lastIndex for the stateful regex
      combined.lastIndex = 0;
      const newText = part.replace(combined, (match) => {
        const key = match.toLowerCase();
        if (linkedThisPass.has(key)) return match; // already linked → leave as-is
        const href = hrefMap.get(key);
        if (!href) return match;
        linkedThisPass.add(key);
        return `<a href="${href}" class="glossary-link">${match}</a>`;
      });

      result.push(newText);
    }
  }

  return result.join('');
}

module.exports = { linkGlossaryTerms };
