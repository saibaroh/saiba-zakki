(function () {
  // =============================================
  // 定数
  // =============================================
  const STARTPOS = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
  const KANJI = {
    P: ['歩', 'と'],
    L: ['香', '杏'],
    N: ['桂', '圭'],
    S: ['銀', '全'],
    G: ['金', '金'],
    B: ['角', '馬'],
    R: ['飛', '龍'],
    K: ['王', '王'],
  };
  const HAND_ORDER = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
  const ROW_LABELS_JA = ['一','二','三','四','五','六','七','八','九'];
  const ROW_LABELS_NUMERIC = ['1','2','3','4','5','6','7','8','9'];
  const IS_ENGLISH_PAGE = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const PIECE_STYLE_STORAGE_KEY = 'sp-piece-style';
  const PIECE_STYLE_OPTIONS = [
    { key: 'kanji', label: 'Kanji' },
    { key: 'alphabet', label: 'ABC' },
  ];

  const ALPHA_MOVES = {
    P:  { dots: ['f'], arrows: [], knight: false },
    L:  { dots: [], arrows: ['f'], knight: false },
    N:  { dots: [], arrows: [], knight: true },
    S:  { dots: ['f', 'fl', 'fr', 'bl', 'br'], arrows: [], knight: false },
    G:  { dots: ['f', 'b', 'l', 'r', 'fl', 'fr'], arrows: [], knight: false },
    K:  { dots: ['f', 'b', 'l', 'r', 'fl', 'fr', 'bl', 'br'], arrows: [], knight: false },
    B:  { dots: [], arrows: ['fl', 'fr', 'bl', 'br'], knight: false },
    R:  { dots: [], arrows: ['f', 'b', 'l', 'r'], knight: false },
    '+P': { dots: ['f', 'b', 'l', 'r', 'fl', 'fr'], arrows: [], knight: false },
    '+L': { dots: ['f', 'b', 'l', 'r', 'fl', 'fr'], arrows: [], knight: false },
    '+N': { dots: ['f', 'b', 'l', 'r', 'fl', 'fr'], arrows: [], knight: false },
    '+S': { dots: ['f', 'b', 'l', 'r', 'fl', 'fr'], arrows: [], knight: false },
    '+B': { dots: ['f', 'b', 'l', 'r'], arrows: ['fl', 'fr', 'bl', 'br'], knight: false },
    '+R': { dots: ['fl', 'fr', 'bl', 'br'], arrows: ['f', 'b', 'l', 'r'], knight: false },
  };

  const ALPHA_ARROW_LABELS = {
    f: '↑', b: '↓', l: '←', r: '→',
    fl: '↖', fr: '↗', bl: '↙', br: '↘',
  };

  function normalizePieceStyle(value) {
    const v = String(value || '').trim().toLowerCase();
    if (['alphabet', 'alpha', 'abc', 'en', 'english'].includes(v)) return 'alphabet';
    if (['kanji', 'jp', 'ja', 'japanese'].includes(v)) return 'kanji';
    return null;
  }

  function getSavedPieceStyle() {
    try {
      return normalizePieceStyle(localStorage.getItem(PIECE_STYLE_STORAGE_KEY));
    } catch (_) {
      return null;
    }
  }

  // 盤と駒の見た目：classic（シンプル）／ mincho（シンプルの盤で、駒の字をひな明朝に）／
  // game（駒風。詰将棋ゲームと同じ木目の盤・五角形の駒）／ holo・sakura（駒風の駒の色違いで、盤は黒漆）。
  // 初期はシンプル。盤の上の切り替えで選んだものを localStorage に覚える。
  // 見比べ用に ?look=classic / mincho / game / holo / sakura で上書きできる（保存はしない）。
  const LOOK_STORAGE_KEY = 'sp-board-look';
  const LOOK_OPTIONS = IS_ENGLISH_PAGE
    ? [{ key: 'classic', label: 'Simple' }, { key: 'mincho', label: 'Mincho' }, { key: 'game', label: 'Wooden' },
       { key: 'holo', label: 'Holo' }, { key: 'sakura', label: 'Sakura' }]
    : [{ key: 'classic', label: 'シンプル' }, { key: 'mincho', label: '明朝' }, { key: 'game', label: '駒風' },
       { key: 'holo', label: 'ホロ' }, { key: 'sakura', label: '桜' }];
  // 駒風の盤・駒で描く見た目（holo / sakura は駒の色違い）
  const isPieceLook = look => ['game', 'holo', 'sakura'].includes(look);
  const normalizeLook = v => LOOK_OPTIONS.some(o => o.key === v) ? v : null;
  let currentLook = (() => {
    const q = normalizeLook(new URLSearchParams(location.search).get('look'));
    if (q) return q;
    try { return normalizeLook(localStorage.getItem(LOOK_STORAGE_KEY)) || 'classic'; } catch (_) { return 'classic'; }
  })();

  let currentPieceStyle = IS_ENGLISH_PAGE ? (getSavedPieceStyle() || 'kanji') : 'kanji';

  // =============================================
  // SFENパーサー
  // board[row][col]: row=0が一段目, col=0が9筋
  // =============================================
  function parseSfen(sfen) {
    if (sfen === 'startpos') sfen = STARTPOS;
    if (sfen.startsWith('sfen ')) sfen = sfen.slice(5);
    const parts = sfen.trim().split(' ');
    const boardStr = parts[0];
    const turn     = (parts[1] || 'b') === 'b' ? 'black' : 'white';
    const handsStr = parts[2] || '-';

    const board = boardStr.split('/').map(rowStr => {
      const row = [];
      for (let i = 0; i < rowStr.length; i++) {
        if (rowStr[i] === '+') {
          i++;
          const ch = rowStr[i];
          row.push({ p: ch.toUpperCase(), color: ch === ch.toUpperCase() ? 'black' : 'white', promoted: true });
        } else if (/\d/.test(rowStr[i])) {
          for (let j = 0; j < +rowStr[i]; j++) row.push(null);
        } else {
          const ch = rowStr[i];
          row.push({ p: ch.toUpperCase(), color: ch === ch.toUpperCase() ? 'black' : 'white', promoted: false });
        }
      }
      return row;
    });

    const hands = { black: {}, white: {} };
    if (handsStr !== '-') {
      for (let i = 0; i < handsStr.length; ) {
        let count = 1;
        if (/\d/.test(handsStr[i])) {
          let n = '';
          while (i < handsStr.length && /\d/.test(handsStr[i])) n += handsStr[i++];
          count = +n;
        }
        const ch = handsStr[i++];
        const color = ch === ch.toUpperCase() ? 'black' : 'white';
        const h = color === 'black' ? hands.black : hands.white;
        h[ch.toUpperCase()] = (h[ch.toUpperCase()] || 0) + count;
      }
    }

    return { board, hands, turn };
  }

  // =============================================
  // USI形式の一手を適用してstate複製を返す
  // =============================================
  function applyMove(state, move) {
    const s = {
      board: state.board.map(r => r.map(c => c ? { ...c } : null)),
      hands: { black: { ...state.hands.black }, white: { ...state.hands.white } },
      turn:  state.turn,
    };

    const promote = move.endsWith('+');
    const m = promote ? move.slice(0, -1) : move;

    if (m[1] === '*') {
      const piece  = m[0].toUpperCase();
      const toCol  = 9 - +m[2];
      const toRow  = m[3].charCodeAt(0) - 97;
      s.board[toRow][toCol] = { p: piece, color: s.turn, promoted: false };
      const h = s.hands[s.turn];
      h[piece] = (h[piece] || 1) - 1;
      if (!h[piece]) delete h[piece];
    } else {
      const fromCol = 9 - +m[0];
      const fromRow = m[1].charCodeAt(0) - 97;
      const toCol   = 9 - +m[2];
      const toRow   = m[3].charCodeAt(0) - 97;

      const piece    = s.board[fromRow][fromCol];
      const captured = s.board[toRow][toCol];

      if (captured) {
        const h = s.hands[s.turn];
        h[captured.p] = (h[captured.p] || 0) + 1;
      }

      s.board[toRow][toCol]     = { ...piece, promoted: piece.promoted || promote };
      s.board[fromRow][fromCol] = null;
    }

    s.turn = s.turn === 'black' ? 'white' : 'black';
    return s;
  }

  // =============================================
  // USI → 日本語棋譜表記
  // =============================================
  const FW = ['１','２','３','４','５','６','７','８','９'];
  const KR = ['一','二','三','四','五','六','七','八','九'];

  function toJpCoord(col, rowChar) {
    return FW[+col - 1] + KR[rowChar.charCodeAt(0) - 97];
  }

  function usiToJp(move, stateBefore) {
    const color  = stateBefore.turn;
    const marker = color === 'black' ? '▲' : '△';
    const promote = move.endsWith('+');
    const m = promote ? move.slice(0, -1) : move;

    if (m[1] === '*') {
      const jp = KANJI[m[0].toUpperCase()][0];
      return marker + toJpCoord(m[2], m[3]) + jp + '打';
    }

    const fromArrCol = 9 - +m[0];
    const fromArrRow = m[1].charCodeAt(0) - 97;
    const piece = stateBefore.board[fromArrRow][fromArrCol];

    let label;
    if (piece.p === 'K') {
      label = color === 'black' ? '王' : '玉';
    } else {
      label = KANJI[piece.p][piece.promoted ? 1 : 0];
    }

    return marker + toJpCoord(m[2], m[3]) + label + (promote ? '成' : '');
  }

  // 英語ページ用：西洋式の表記（盤の段ラベルに合わせて数字座標。例 ☗Rx34, ☖P*55, ☗Bx22+）
  function usiToEn(move, stateBefore) {
    const marker  = stateBefore.turn === 'black' ? '☗' : '☖';
    const promote = move.endsWith('+');
    const m = promote ? move.slice(0, -1) : move;
    const dest = m[2] + (m[3].charCodeAt(0) - 96);
    if (m[1] === '*') return marker + m[0].toUpperCase() + '*' + dest;
    const piece  = stateBefore.board[m[1].charCodeAt(0) - 97][9 - +m[0]];
    const target = stateBefore.board[m[3].charCodeAt(0) - 97][9 - +m[2]];
    return marker + (piece.promoted ? '+' : '') + piece.p + (target ? 'x' : '-') + dest + (promote ? '+' : '');
  }

  const UI = IS_ENGLISH_PAGE ? {
    whiteHand: 'White (gote) in hand:',
    blackHand: 'Black (sente) in hand:',
    none:      'None',
    start:     total => total > 0 ? `Start / ${total} moves` : 'Start',
    progress:  (mv, idx, total) => `${mv}  ${idx} / ${total}`,
  } : {
    whiteHand: '後手の持ち駒：',
    blackHand: '先手の持ち駒：',
    none:      'なし',
    start:     total => total > 0 ? `初期局面 / 全${total}手` : '初期局面',
    progress:  (mv, idx, total) => `${mv}　${idx} / ${total}手`,
  };

  // =============================================
  // HTMLビルダー
  // =============================================
  function alphaMoveHtml(cell) {
    const key = (cell.promoted ? '+' : '') + cell.p;
    const pattern = ALPHA_MOVES[key] || ALPHA_MOVES[cell.p] || { dots: [], arrows: [], knight: false };
    const dots = pattern.dots
      .map(dir => `<span class="sp-alpha-dot sp-dot-${dir}"></span>`)
      .join('');
    const arrows = pattern.arrows
      .map(dir => `<span class="sp-alpha-arrow sp-arrow-${dir}">${ALPHA_ARROW_LABELS[dir]}</span>`)
      .join('');
    const knight = pattern.knight
      ? '<span class="sp-alpha-dot sp-knight-left"></span><span class="sp-alpha-dot sp-knight-right"></span>'
      : '';
    return dots + arrows + knight;
  }

  function kanjiLabel(cell) {
    if (cell.p === 'K') return cell.color === 'black' ? '王' : '玉';
    const k = KANJI[cell.p];
    return k ? k[cell.promoted ? 1 : 0] : cell.p;
  }

  // 詰将棋ゲームと同じ五角形の駒（css/shogi-player.css の .pc）
  function gamePieceHtml(cell, pieceStyle) {
    const alpha = pieceStyle === 'alphabet';
    const cls = ['pc', 'pc-' + cell.p,
      cell.color === 'white' ? 'enemy' : 'own',
      cell.promoted ? 'promoted' : '',
      alpha ? 'letter' : 'kanji'
    ].filter(Boolean).join(' ');
    const sym = alpha ? (cell.promoted ? '+' : '') + cell.p : kanjiLabel(cell);
    return `<span class="${cls}"><span class="pc-face"><span class="pc-sym">${sym}</span></span></span>`;
  }

  function pieceHtml(cell, pieceStyle) {
    if (!cell) return '';
    if (isPieceLook(currentLook)) return gamePieceHtml(cell, pieceStyle);
    if (pieceStyle === 'alphabet') {
      const cls = ['sp-piece', 'sp-alpha-piece',
        cell.color === 'white' ? 'sp-white' : '',
        cell.promoted ? 'sp-promoted' : ''
      ].filter(Boolean).join(' ');
      const plus = cell.promoted ? '<span class="sp-piece-plus">+</span>' : '';
      return `<span class="${cls}">${alphaMoveHtml(cell)}<span class="sp-piece-label">${cell.p}</span>${plus}</span>`;
    }

    let label;
    if (cell.p === 'K') {
      label = cell.color === 'black' ? '王' : '玉';
    } else {
      const k = KANJI[cell.p];
      label = k ? k[cell.promoted ? 1 : 0] : cell.p;
    }
    const cls = ['sp-piece',
      cell.color === 'white' ? 'sp-white' : '',
      cell.promoted ? 'sp-promoted' : ''
    ].filter(Boolean).join(' ');
    return `<span class="${cls}">${label}</span>`;
  }

  function handHtml(hand, pieceStyle) {
    const pieces = HAND_ORDER.filter(p => hand[p] > 0);
    if (!pieces.length) return `<span class="sp-hand-empty">${UI.none}</span>`;
    if (isPieceLook(currentLook)) {
      // 持ち駒は今の表示と同じく、先手・後手とも正面向きで並べる
      return pieces.map(p => {
        const cnt = hand[p] > 1 ? `<sup>${hand[p]}</sup>` : '';
        return `<span class="sp-hand-pc">${gamePieceHtml({ p, color: 'black', promoted: false }, pieceStyle)}</span>${cnt}`;
      }).join('');
    }
    return pieces.map(p => {
      const label = pieceStyle === 'alphabet' ? p : KANJI[p][0];
      const cnt   = hand[p] > 1 ? `<sup>${hand[p]}</sup>` : '';
      const cls = pieceStyle === 'alphabet' ? 'sp-hand-piece sp-hand-piece-alpha' : 'sp-hand-piece';
      return `<span class="${cls}">${label}${cnt}</span>`;
    }).join('');
  }

  // diagram=true のとき持ち駒・コントロールを非表示（showHands=true なら持ち駒は表示）
  function buildHtml(state, lastMove, idx, total, caption, kifuLines, diagram, pieceStyle, showHands) {
    let hlRow = -1, hlCol = -1;
    if (lastMove) {
      const m = lastMove.replace(/\+$/, '');
      hlCol = 9 - +m[m[1] === '*' ? 2 : 2];
      hlRow = m[m[1] === '*' ? 3 : 3].charCodeAt(0) - 97;
    }

    const colLabels = Array.from({ length: 9 }, (_, i) =>
      `<div>${9 - i}</div>`
    ).join('');

    const HOSHI = new Set(['2-2','2-5','5-2','5-5']);
    let cells = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const hl    = (r === hlRow && c === hlCol) ? ' sp-highlight' : '';
        const hoshi = HOSHI.has(`${r}-${c}`) ? ' sp-hoshi' : '';
        cells += `<div class="sp-cell${hl}${hoshi}">${pieceHtml(state.board[r][c], pieceStyle)}</div>`;
      }
    }

    const rowLabelValues = (IS_ENGLISH_PAGE || pieceStyle === 'alphabet') ? ROW_LABELS_NUMERIC : ROW_LABELS_JA;
    const rowLabels = rowLabelValues.map(l => `<div class="sp-row-label">${l}</div>`).join('');

    const currentJp = idx > 0 ? kifuLines[idx - 1] : null;
    const infoText  = idx === 0 ? UI.start(total) : UI.progress(currentJp, idx, total);

    const prevDisabled = idx === 0 ? 'disabled' : '';
    const nextDisabled = idx === total ? 'disabled' : '';

    const kifuSection = kifuLines && kifuLines.length > 0 ? `
      <div class="sp-kifu">
        ${kifuLines.map((k, i) => `
          <div class="sp-kifu-row${i + 1 === idx ? ' is-current' : ''}" data-goto="${i + 1}">
            <span class="sp-kifu-num">${i + 1}</span>
            <span>${k}</span>
          </div>
        `).join('')}
      </div>` : '';

    const handSection = (!diagram || showHands) ? `
      <div class="sp-hand">
        <span class="sp-hand-label">${UI.whiteHand}</span>
        ${handHtml(state.hands.white, pieceStyle)}
      </div>` : '';

    const handSectionBottom = (!diagram || showHands) ? `
      <div class="sp-hand">
        <span class="sp-hand-label">${UI.blackHand}</span>
        ${handHtml(state.hands.black, pieceStyle)}
      </div>` : '';

    const controlSection = diagram && total === 0 ? '' :
      total > 0 ? `
      <div class="sp-controls">
        <button class="sp-btn" data-action="first" ${prevDisabled}>|◁</button>
        <button class="sp-btn" data-action="prev"  ${prevDisabled}>◁</button>
        <span class="sp-info">${infoText}</span>
        <button class="sp-btn" data-action="next"  ${nextDisabled}>▷</button>
        <button class="sp-btn" data-action="last"  ${nextDisabled}>▷|</button>
      </div>` :
      `<div class="sp-info" style="text-align:center; margin-top:6px;">${infoText}</div>`;

    const lookToggle = `
      <div class="sp-look-toggle" role="group" aria-label="${IS_ENGLISH_PAGE ? 'Board style' : '盤の表示'}">
        ${LOOK_OPTIONS.map(o => `<button type="button" class="sp-look-btn${o.key === currentLook ? ' is-active' : ''}" data-look="${o.key}" aria-pressed="${o.key === currentLook}">${o.label}</button>`).join('')}
      </div>`;

    return `
      ${lookToggle}
      ${handSection}
      <div class="sp-col-labels">${colLabels}</div>
      <div class="sp-layout">
        <div class="sp-board-and-rows">
          <div class="sp-board-frame"><div class="sp-board">${cells}</div></div>
          <div class="sp-row-labels">${rowLabels}</div>
        </div>
        ${kifuSection}
      </div>
      ${handSectionBottom}
      ${controlSection}
      ${caption ? `<div class="sp-caption">${caption}</div>` : ''}
    `;
  }

  // =============================================
  // ShogiPlayerクラス
  // =============================================
  class ShogiPlayer {
    constructor(el) {
      this.el      = el;
      this.diagram = el.hasAttribute('data-diagram');
      this.showHands = el.hasAttribute('data-show-hands');
      this.fixedPieceStyle = normalizePieceStyle(el.dataset.pieceStyle);
      const sfen     = el.dataset.sfen    || 'startpos';
      const movesStr = el.dataset.moves   || '';
      const caption  = el.dataset.caption || '';

      const initial = parseSfen(sfen);
      this.moves    = movesStr.trim() ? movesStr.trim().split(/\s+/) : [];
      this.caption  = caption;

      this.history = [initial];
      let s = initial;
      for (const mv of this.moves) {
        s = applyMove(s, mv);
        this.history.push(s);
      }

      this.kifuLines = this.moves.map((mv, i) => (IS_ENGLISH_PAGE ? usiToEn : usiToJp)(mv, this.history[i]));
      this.idx = 0;
      this.render();
    }

    render() {
      const lastMove = this.idx > 0 ? this.moves[this.idx - 1] : null;
      const pieceStyle = this.fixedPieceStyle || currentPieceStyle;
      this.el.classList.toggle('sp-piece-style-alpha', pieceStyle === 'alphabet');
      this.el.classList.toggle('sp-piece-style-kanji', pieceStyle === 'kanji');
      this.el.classList.toggle('sp-look-game', isPieceLook(currentLook));
      this.el.classList.toggle('sp-pieces-holo', currentLook === 'holo');
      this.el.classList.toggle('sp-pieces-sakura', currentLook === 'sakura');
      this.el.classList.toggle('sp-look-mincho', currentLook === 'mincho');
      this.el.innerHTML = buildHtml(
        this.history[this.idx], lastMove,
        this.idx, this.moves.length, this.caption, this.kifuLines, this.diagram, pieceStyle, this.showHands
      );

      this.el.querySelectorAll('.sp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const actions = { first: 0, prev: this.idx - 1, next: this.idx + 1, last: this.history.length - 1 };
          const n = actions[btn.dataset.action];
          if (n !== undefined) this.go(n);
        });
      });

      this.el.querySelectorAll('.sp-look-btn').forEach(btn => {
        btn.addEventListener('click', () => applyLook(btn.dataset.look));
      });

      this.el.querySelectorAll('.sp-kifu-row').forEach(row => {
        row.addEventListener('click', () => this.go(+row.dataset.goto));
      });

      const kifu = this.el.querySelector('.sp-kifu');
      const cur  = this.el.querySelector('.sp-kifu-row.is-current');
      if (kifu && cur) {
        const top = cur.offsetTop - kifu.clientHeight / 2 + cur.clientHeight / 2;
        kifu.scrollTop = top;
      }
    }

    go(n) {
      this.idx = Math.max(0, Math.min(n, this.history.length - 1));
      this.render();
    }
  }

  // どれか1つの盤で切り替えたら、ページ内の盤を全部切り替えて覚えておく
  function applyLook(look) {
    const next = normalizeLook(look);
    if (!next || next === currentLook) return;
    currentLook = next;
    try { localStorage.setItem(LOOK_STORAGE_KEY, next); } catch (_) {}
    players.forEach(player => player.render());
  }

  // ページ内の全要素を初期化
  const players = Array.from(document.querySelectorAll('.shogi-player'), el => new ShogiPlayer(el));

  // 英語版の囲いのページなどに置いた #sp-theme-picker に、駒の表記の切り替えを入れる
  const picker = document.getElementById('sp-theme-picker');

  // =============================================
  // 英語版の駒スタイルスイッチャー
  // =============================================
  function syncPieceStyleButtons() {
    document.querySelectorAll('.sp-piece-style-btn').forEach(btn => {
      const active = btn.dataset.style === currentPieceStyle;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function applyPieceStyle(style) {
    const next = normalizePieceStyle(style) || 'kanji';
    currentPieceStyle = next;
    try { localStorage.setItem(PIECE_STYLE_STORAGE_KEY, next); } catch (_) {}
    syncPieceStyleButtons();
    players.forEach(player => player.render());
  }

  if (picker && IS_ENGLISH_PAGE && players.length) {
    const group = document.createElement('div');
    group.className = 'sp-piece-style-group';

    const label = document.createElement('span');
    label.className = 'sp-theme-label';
    label.textContent = 'Pieces:';
    group.appendChild(label);

    const toggle = document.createElement('div');
    toggle.className = 'sp-piece-style-toggle';
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', 'Piece style');

    PIECE_STYLE_OPTIONS.forEach(option => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-piece-style-btn';
      btn.dataset.style = option.key;
      btn.textContent = option.label;
      btn.addEventListener('click', () => applyPieceStyle(option.key));
      toggle.appendChild(btn);
    });

    group.appendChild(toggle);
    picker.appendChild(group);
    syncPieceStyleButtons();
  }

})();
