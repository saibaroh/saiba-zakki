#!/usr/bin/env python3
"""
tools/make-og-images.py — ブログ記事ごとの SNS 共有画像（OGP, 1200x630）を作る

{lang}/blog/posts/*.md の frontmatter（title / category / slug）から
images/og/{lang}-{slug}.png を生成する。build-posts-html.js はこの画像があれば
og:image に使い、twitter:card を summary_large_image にする。

Usage:
  python3 tools/make-og-images.py        # .md より古い／存在しない画像だけ作る
  python3 tools/make-og-images.py --all  # すべて作り直す

Requires: Pillow と日本語フォント（Noto Sans JP 推奨。環境変数 OG_FONT_BOLD /
OG_FONT_REGULAR でフォントファイルを直接指定することもできる）
"""
import os
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'images' / 'og'
W, H = 1200, 630
PAD_X = 88

PAPER = '#F5F0E6'
INK = '#2B2724'
MUTED = '#6B6259'
RULE = '#D6CBB8'
SHU = '#B5432F'
WOOD = '#C4A276'
WOOD_DARK = '#9C7A50'

SITE = {'ja': 'さいばの将棋ポータル', 'en': "Saiba's Shogi Portal"}
DOMAIN = 'shogi.saiba-zakki.com'

# 行頭に置かない文字（禁則）
NO_LINE_START = set('、。，．・：；？！ー」』）】〕〉》”’ゃゅょっぁぃぅぇぉャュョッァィゥェォ…‥,.:;?!)]}')


def find_font(env_key, fc_pattern, candidates):
    path = os.environ.get(env_key)
    if path and Path(path).exists():
        return path
    for c in candidates:
        if Path(c).exists():
            return c
    try:
        out = subprocess.run(['fc-match', '-f', '%{file}', fc_pattern],
                             capture_output=True, text=True, check=True).stdout.strip()
        if out and Path(out).exists():
            return out
    except (OSError, subprocess.CalledProcessError):
        pass
    sys.exit(f'Font not found for "{fc_pattern}". Set {env_key}=/path/to/font.ttf')


FONT_BOLD = find_font('OG_FONT_BOLD', 'Noto Sans JP:bold', [
    '/usr/share/fonts/Noto_Sans_JP/static/NotoSansJP-Bold.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',
])
FONT_REGULAR = find_font('OG_FONT_REGULAR', 'Noto Sans JP', [
    '/usr/share/fonts/Noto_Sans_JP/static/NotoSansJP-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
])


def read_frontmatter(md_path):
    text = md_path.read_text(encoding='utf-8')
    m = re.match(r'^---\n(.*?)\n---', text, re.S)
    data = {}
    if m:
        for line in m.group(1).splitlines():
            k, sep, v = line.partition(':')
            if sep:
                data[k.strip()] = v.strip().strip('"').strip("'")
    return data


def wrap(text, font, max_width):
    """英単語はまとめて、日本語は1文字ずつ詰める。禁則文字は前の行に残す。"""
    units = re.findall(r"[A-Za-z0-9'’\-]+|\s+|.", text)
    lines, cur = [], ''
    for u in units:
        trial = cur + u
        if cur and font.getlength(trial.rstrip()) > max_width and not u.isspace():
            if u[0] in NO_LINE_START:
                cur = trial
                continue
            lines.append(cur.rstrip())
            cur = u
        else:
            cur = trial
    if cur.strip():
        lines.append(cur.rstrip())
    return [l.lstrip() for l in lines]


def fit_title(draw, title, max_width, max_lines=3):
    for size in (64, 58, 52, 46, 40):
        font = ImageFont.truetype(FONT_BOLD, size)
        lines = wrap(title, font, max_width)
        if len(lines) <= max_lines:
            return font, lines
    return font, lines[:max_lines]


def render(lang, title, category, out_path):
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)

    # カテゴリ
    y = 86
    if category:
        f_cat = ImageFont.truetype(FONT_BOLD, 30)
        d.text((PAD_X, y), category, font=f_cat, fill=SHU)
        y += 64

    # タイトル
    font, lines = fit_title(d, title, W - PAD_X * 2)
    line_h = int(font.size * 1.45)
    for line in lines:
        d.text((PAD_X, y), line, font=font, fill=INK)
        y += line_h

    # フッター（罫線・サイト名・ドメイン）
    rule_y = 478
    d.line([(PAD_X, rule_y), (W - PAD_X, rule_y)], fill=RULE, width=2)
    f_site = ImageFont.truetype(FONT_BOLD, 30)
    f_dom = ImageFont.truetype(FONT_REGULAR, 24)
    d.text((PAD_X, rule_y + 30), SITE[lang], font=f_site, fill=INK)
    dom_w = d.textlength(DOMAIN, font=f_dom)
    d.text((W - PAD_X - dom_w, rule_y + 36), DOMAIN, font=f_dom, fill=MUTED)

    # 棚板（本の紹介ページの本棚と揃える）
    d.rectangle([(0, H - 26), (W, H - 8)], fill=WOOD)
    d.rectangle([(0, H - 8), (W, H)], fill=WOOD_DARK)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(out_path, 'PNG', optimize=True)


def main():
    force = '--all' in sys.argv
    script_mtime = Path(__file__).stat().st_mtime
    count = 0
    for lang in ('ja', 'en'):
        for md in sorted((ROOT / lang / 'blog' / 'posts').glob('*.md')):
            fm = read_frontmatter(md)
            if not fm.get('title'):
                continue
            slug = fm.get('slug') or md.stem
            out = OUT_DIR / f'{lang}-{slug}.png'
            if not force and out.exists() and out.stat().st_mtime >= max(md.stat().st_mtime, script_mtime):
                continue
            title = fm['title'].replace('<br>', ' ')
            render(lang, title, fm.get('category', ''), out)
            print(f'{out.relative_to(ROOT)}')
            count += 1
    print(f'Done. {count} OG image(s) generated.')


if __name__ == '__main__':
    main()
