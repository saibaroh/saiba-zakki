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
  const ROW_LABELS  = ['一','二','三','四','五','六','七','八','九'];

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

  // =============================================
  // HTMLビルダー
  // =============================================
  function pieceHtml(cell) {
    if (!cell) return '';
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

  function handHtml(hand) {
    const pieces = HAND_ORDER.filter(p => hand[p] > 0);
    if (!pieces.length) return '<span class="sp-hand-empty">なし</span>';
    return pieces.map(p => {
      const label = KANJI[p][0];
      const cnt   = hand[p] > 1 ? `<sup>${hand[p]}</sup>` : '';
      return `<span class="sp-hand-piece">${label}${cnt}</span>`;
    }).join('');
  }

  // diagram=true のとき持ち駒・コントロールを非表示
  function buildHtml(state, lastMove, idx, total, caption, kifuLines, diagram) {
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
        cells += `<div class="sp-cell${hl}${hoshi}">${pieceHtml(state.board[r][c])}</div>`;
      }
    }

    const rowLabels = ROW_LABELS.map(l => `<div class="sp-row-label">${l}</div>`).join('');

    const currentJp = idx > 0 ? kifuLines[idx - 1] : null;
    const infoText  = idx === 0
      ? (total > 0 ? `初期局面 / 全${total}手` : '初期局面')
      : `${currentJp}　${idx} / ${total}手`;

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

    const handSection = !diagram ? `
      <div class="sp-hand">
        <span class="sp-hand-label">後手の持ち駒：</span>
        ${handHtml(state.hands.white)}
      </div>` : '';

    const handSectionBottom = !diagram ? `
      <div class="sp-hand">
        <span class="sp-hand-label">先手の持ち駒：</span>
        ${handHtml(state.hands.black)}
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

    return `
      ${handSection}
      <div class="sp-col-labels">${colLabels}</div>
      <div class="sp-layout">
        <div class="sp-board-and-rows">
          <div class="sp-board">${cells}</div>
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

      this.kifuLines = this.moves.map((mv, i) => usiToJp(mv, this.history[i]));
      this.idx = 0;
      this.render();
    }

    render() {
      const lastMove = this.idx > 0 ? this.moves[this.idx - 1] : null;
      this.el.innerHTML = buildHtml(
        this.history[this.idx], lastMove,
        this.idx, this.moves.length, this.caption, this.kifuLines, this.diagram
      );

      this.el.querySelectorAll('.sp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const actions = { first: 0, prev: this.idx - 1, next: this.idx + 1, last: this.history.length - 1 };
          const n = actions[btn.dataset.action];
          if (n !== undefined) this.go(n);
        });
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

  // ページ内の全要素を初期化
  document.querySelectorAll('.shogi-player').forEach(el => new ShogiPlayer(el));

  // =============================================
  // 盤面カラーテーマスイッチャー
  // =============================================
  const THEMES = [
    { key: 'wood',   label: '木材',    bg: '#f2e8d8', hl: '#f0ee88' },
    { key: 'gray',   label: 'グレー',  bg: '#ebebeb', hl: '#f0ee70' },
    { key: 'lime',   label: 'ライム',  bg: '#e8f2dc', hl: '#eef580' },
    { key: 'citrus', label: 'シトラス', bg: '#faf6d0', hl: '#f8f878' },
    { key: 'blue',   label: 'ブルー',  bg: '#dce8f5', hl: '#eef578' },
    { key: 'cyan',   label: '水色',    bg: '#d8eff5', hl: '#eef578' },
    { key: 'pink',   label: 'ピンク',  bg: '#f8e8f2', hl: '#f8f080' },
  ];

  const THEME_STORAGE_KEY = 'sp-board-theme';

  function applyTheme(theme) {
    document.documentElement.style.setProperty('--sp-board-bg', theme.bg);
    document.documentElement.style.setProperty('--sp-board-hl', theme.hl);
    document.querySelectorAll('.sp-theme-btn').forEach(b =>
      b.classList.toggle('is-active', b.dataset.key === theme.key)
    );
    try { localStorage.setItem(THEME_STORAGE_KEY, theme.key); } catch (_) {}
  }

  const picker = document.getElementById('sp-theme-picker');
  if (picker) {
    THEMES.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'sp-theme-btn';
      btn.dataset.key = t.key;
      btn.style.background = t.bg;
      btn.title = t.label;
      btn.addEventListener('click', () => applyTheme(t));
      picker.appendChild(btn);
    });
  }

  const savedKey = (() => { try { return localStorage.getItem(THEME_STORAGE_KEY); } catch (_) { return null; } })();
  const initialTheme = THEMES.find(t => t.key === savedKey) || THEMES[0];
  applyTheme(initialTheme);

})();
