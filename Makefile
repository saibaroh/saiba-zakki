.PHONY: build build-en build-ja

# 記事追加後のビルド（通常はこれだけ）
build:
	node build.js

# 英語記事のみビルド
build-en:
	node build.js en

# 日本語記事のみビルド
build-ja:
	node build.js ja
