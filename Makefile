.PHONY: help build serve kill build-release clean install-playwright test test-ui default ayce

default: ayce

help:
	@echo "gfarena0-web — available targets:"
	@echo ""
	@echo "  build               wasm-pack dev build -> www/pkg/"
	@echo "  build-release       wasm-pack release build (optimised)"
	@echo "  serve               dev build + python3 http.server on :8080"
	@echo "  kill                kill the http.server on :8080"
	@echo "  clean               cargo clean + remove www/pkg/"
	@echo "  install-playwright  npm install + playwright install chromium"
	@echo "  test                dev build + playwright headless tests"
	@echo "  test-ui             dev build + playwright interactive UI"

build:
	wasm-pack build --target web --out-dir www/pkg

serve: build
	@echo "Serving at http://localhost:8080"
	cd www && python3 -m http.server 8080

kill:
	@lsof -ti :8080 | xargs kill 2>/dev/null || echo "Nothing running on :8080"

build-release:
	wasm-pack build --release --target web --out-dir www/pkg

clean:
	cargo clean
	rm -rf www/pkg

node_modules: package.json
	npm install

install-playwright: node_modules
	npx playwright install chromium

test: build node_modules
	npx playwright test

test-ui: build node_modules
	npx playwright test --ui

# All You Can Eat - clean, build, and test
ayce: clean build test
