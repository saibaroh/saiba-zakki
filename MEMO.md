# ブログ記事の追加手順

## 1. Markdown ファイルを作成する

言語に応じて以下のフォルダに `.md` ファイルを置く。

| 言語 | フォルダ |
|---|---|
| 日本語 | `ja/blog/posts/` |
| 英語 | `en/blog/posts/` |

ファイル名がそのまま URL の `slug` になる（例: `my-article.md` → `?slug=my-article`）。

---

## 2. frontmatter を書く

ファイルの先頭に以下の形式で記述する。

```yaml
---
title: "記事タイトル"
titleHtml: "記事タイトル<br>（改行したい場合のみ）"
date: "2026-04-05"
category: "カテゴリ名"
lead: "リード文（一覧ページや SNS シェア時に表示される）"
thumbnail: ""
---

本文はここから（通常の Markdown）
```

**省略可能なフィールド**

| フィールド | 省略時の挙動 |
|---|---|
| `titleHtml` | `title` の値をそのまま使用 |
| `thumbnail` | 画像なし、OG image は profile.webp |
| `slug` | ファイル名（拡張子なし）を使用 |

---

## 3. ビルドを実行する

```bash
make           # en・ja 両方（通常はこれだけでOK）
make build-ja  # ja のみ
make build-en  # en のみ
```

以下をまとめて実行する：
- 表紙などの画像から表示用の軽量 WebP を作る（`tools/optimize-images.py`、`make images` 単体でも可）
- 記事ごとの SNS 共有画像 `images/og/{lang}-{slug}.png` を作る（`tools/make-og-images.py`、`make og` 単体でも可）
- `posts.json` の再生成（frontmatter から）
- 記事ページ・ブログ一覧の HTML 生成
- `sitemap.xml` の更新
- `feed.xml`（RSS）の更新（`en/blog/feed.xml` / `ja/blog/feed.xml`）

画像の変換・共有画像の生成には Python の Pillow と日本語フォント（Noto Sans JP）が必要。
無い環境ではこの2つだけスキップされ、残りのビルドは通常どおり進む。

---

## ブログ記事に盤面図を入れる

Markdown に ```` ```board ```` ブロックを書くと、ビルド時に盤面図になる
（盤面用の CSS / JS はその記事にだけ自動で読み込まれる）。

````markdown
```board
sfen: 9/9/9/9/9/2P6/PP1PPPPPP/1BK1GS1R1/LNSG3NL b - 1
caption: 舟囲い
```

```board
sfen: startpos
moves: 7g7f 3c3d 2g2f
caption: 序盤の進行例
```
````

| キー | 説明 |
|---|---|
| `sfen` | 局面（SFEN）。`startpos` で平手初期局面 |
| `moves` | USI 形式の手順（省略可）。書くと再生ボタンと棋譜が付く。省略すると静止図 |
| `caption` | 盤面下のキャプション（省略可） |

---

## 将棋盤の埋め込み方（HTML ページ）

テストページ: `/test/index.html`

### 必要なファイルを読み込む

ページの `<head>` に追加：

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+Antique:wght@700&display=swap" rel="stylesheet">
```

盤面の CSS と JS は `/test/index.html` から `.shogi-player` 関連のスタイル・スクリプトをコピーして該当ページに追加する。

### 基本的な使い方

```html
<!-- 初期局面のみ（手順なし） -->
<div class="shogi-player"
     data-sfen="startpos">
</div>

<!-- 手順あり -->
<div class="shogi-player"
     data-sfen="startpos"
     data-moves="7g7f 3c3d 8h2b+ 3a2b 2h7h"
     data-caption="角換わりの出だし">
</div>

<!-- 途中局面から -->
<div class="shogi-player"
     data-sfen="lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
     data-moves="7g7f"
     data-caption="説明文">
</div>
```

### data 属性

| 属性 | 説明 |
|---|---|
| `data-sfen` | 開始局面を SFEN 形式で。`startpos` で平手初期局面 |
| `data-moves` | USI 形式の手順をスペース区切りで。省略可 |
| `data-caption` | 盤面下に表示するキャプション。省略可 |

### USI 手順の書き方

```
7g7f       # 7七→7六（列+段→列+段、段はアルファベット a=一 〜 i=九）
7g7f+      # 成り
P*5e       # 歩を5五に打つ（駒記号＋*＋座標）
```

### 盤面カラーテーマ

ユーザーが選んだ色は `localStorage` のキー `sp-board-theme` に保存される。
テーマスイッチャー UI を使う場合は `/test/index.html` の `THEMES` 配列と初期化コードをコピーする。

対応テーマ: `wood`（木材）/ `gray`（グレー）/ `lime`（ライム）/ `citrus`（シトラス）/ `blue`（ブルー）/ `cyan`（水色）/ `pink`（ピンク）
