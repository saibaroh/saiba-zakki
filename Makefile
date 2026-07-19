PORT ?= 9000

.PHONY: build build-en build-ja serve

# 記事追加後のビルド（通常はこれだけ）
build:
	node build.js

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
