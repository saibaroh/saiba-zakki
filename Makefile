PORT ?= 9000

.PHONY: build build-en build-ja serve images og

# 記事追加後のビルド（通常はこれだけ）
build: images og
	node build.js

# 表紙などの画像から表示用の軽量 WebP を作る（Pillow が必要。失敗してもビルドは続行）
images:
	-python3 tools/optimize-images.py

# ブログ記事ごとの SNS 共有画像（images/og/）を作る（Pillow と日本語フォントが必要。失敗してもビルドは続行）
og:
	-python3 tools/make-og-images.py

# 英語記事のみビルド
build-en:
	node build.js en

# 日本語記事のみビルド
build-ja:
	node build.js ja

# ローカル確認用サーバー
serve:
	@echo "Serving http://localhost:$(PORT)/"
	python3 -m http.server $(PORT) --bind 127.0.0.1
