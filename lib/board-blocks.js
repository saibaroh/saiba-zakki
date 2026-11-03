/**
 * lib/board-blocks.js
 *
 * Shared by build-posts-html.js and build-problems.js.
 */

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
 * Replace <pre><code class="language-board">…</code></pre> blocks with a
 * shogi-player board (js/shogi-player.js).
 *
 *   ```board
 *   sfen: 9/9/9/9/9/2P6/PP1PPPPPP/1BK1GS1R1/LNSG3NL b - 1
 *   moves: 7g7f 3c3d        (optional — adds move controls)
 *   caption: 舟囲い          (optional)
 *   hands: show              (optional — show pieces in hand on a still diagram)
 *   ```
 *
 * Returns { html, hasBoard }.
 */
function processBoards(html) {
  let hasBoard = false;
  const out = html.replace(
    /<pre><code class="language-board">([\s\S]*?)<\/code><\/pre>/g,
    (_, raw) => {
      const data = {};
      unescHtml(raw).trim().split('\n').forEach(line => {
        const i = line.indexOf(':');
        if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
      hasBoard = true;
      const attrs = [
        data.moves ? '' : ' data-diagram',
        data.hands === 'show' ? ' data-show-hands' : '',
        ` data-sfen="${esc(data.sfen || 'startpos')}"`,
        data.moves   ? ` data-moves="${esc(data.moves)}"`     : '',
        data.caption ? ` data-caption="${esc(data.caption)}"` : '',
      ].join('');
      return `<div class="board-center"><div class="shogi-player"${attrs}></div></div>`;
    }
  );
  return { html: out, hasBoard };
}

module.exports = { processBoards };
