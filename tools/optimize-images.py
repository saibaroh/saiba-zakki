#!/usr/bin/env python3
"""
tools/optimize-images.py — 表紙画像などから表示用の軽量 WebP を作る

images/ 直下の .jpg / .png（100KB 以上のもの）を、幅 600px 以下の .webp に変換して
同じフォルダに保存する（例: images/ja-book1.jpg → images/ja-book1.webp）。
元の .jpg は OGP・構造化データ用にそのまま残す。

Usage:
  python3 tools/optimize-images.py        # 元画像より古い／存在しない .webp だけ作る
  python3 tools/optimize-images.py --all  # すべて作り直す

Requires: Pillow (pip install Pillow)
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'images'
MAX_WIDTH = 600
QUALITY = 82
MIN_BYTES = 100 * 1024

force = '--all' in sys.argv
count = 0
for src in sorted(IMAGES.iterdir()):
    if src.suffix.lower() not in ('.jpg', '.jpeg', '.png') or src.stat().st_size < MIN_BYTES:
        continue
    dst = src.with_suffix('.webp')
    if not force and dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        continue
    with Image.open(src) as im:
        im = im.convert('RGB')
        if im.width > MAX_WIDTH:
            im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=QUALITY, method=6)
    print(f'{src.name} ({src.stat().st_size // 1024}KB) -> {dst.name} ({dst.stat().st_size // 1024}KB)')
    count += 1
print(f'Done. {count} image(s) converted.')
