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

## 3. posts.json を更新する

```bash
node build-posts-json.js        # en・ja 両方
node build-posts-json.js ja     # ja のみ
node build-posts-json.js en     # en のみ
```

---

## 4. sitemap.xml を更新する

```bash
node build-sitemap.js
```

---

## まとめ（毎回の作業）

```bash
# 1. md ファイルを作成・編集
# 2. 以下の 2 コマンドを実行
node build-posts-json.js
node build-sitemap.js
```
