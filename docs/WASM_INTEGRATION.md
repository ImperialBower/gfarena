# Wiring gfcore to the Web

How the Rust card-game engine becomes a static web page: the shim crate, the
`wasm-pack` build, the JSON border, and the deploy.

```
gfcore          gfarena0-web       wasm-pack          www/pkg/         GitHub Pages
Rust rules   →  cdylib shim    →   emits .wasm    →   imported by  →   static hosting,
engine, on      crate              + JS glue          index.html       no server
crates.io
```

---

## Step 1 — Understand the shape before you write anything

Three parts, kept separate:

- **The brain** is Rust. It knows the rules, the bots, and the history.
- **The face** is one HTML file. It draws cards and buttons. It knows no rules.
- **The border** between them carries text only — JSON in, JSON out.

The brain also *keeps* the game. The browser never hands state back to Rust. It
only asks "what is the state now?" and gets a fresh JSON snapshot. That single
decision removes almost all the hard parts of WASM interop.

> **Why it matters.** Passing a rich object across the WASM border means writing
> bindings for every field. Passing a string means writing none. You pay a small
> serialize cost per call and you get a border you can debug with `console.log`.

---

## Step 2 — Make a shim crate whose only job is to compile

gfarena does not re-implement the game. It is a wrapper crate that depends on
`gfcore` and asks Rust to emit a C-style dynamic library — which is what a
`.wasm` module is.

`Cargo.toml`:

```toml
[package]
name        = "gfarena0-web"
version     = "0.0.7"
edition     = "2024"
rust-version = "1.85"

[lib]
crate-type = ["cdylib"]        # the WASM switch

[dependencies]
gfcore       = { version = "0.0.7", features = ["wasm", "history"] }
wasm-bindgen = "0.2"
```

Two things do the work here. `crate-type = ["cdylib"]` tells Cargo to emit a
linkable module instead of a normal Rust `.rlib`. The `"wasm"` feature on gfcore
turns on that crate's own `wasm_api` module, which carries all the
`#[wasm_bindgen]` exports.

The whole shim is nine lines — `src/lib.rs`:

```rust
// This crate exists solely to produce a WASM module from gfcore.
// All game logic and WASM exports live in gfcore::wasm_api.
extern crate gfcore;

use wasm_bindgen::prelude::*;

/// Returns gfarena's own crate version, baked in at compile time.
#[wasm_bindgen]
pub fn arena_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
```

> **Why a shim at all.** gfcore stays a clean, testable Rust library that knows
> nothing about browsers. The shim owns the web-only concerns: the cdylib type,
> the deploy version string, and the feature flags. Swap the shim and the same
> engine drives a CLI or a server.

---

## Step 3 — Build with wasm-pack, straight into the web folder

Install the toolchain once:

```bash
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

Then build. The `Makefile` wraps it, but this is the whole command:

```bash
wasm-pack build --target web --out-dir www/pkg
```

`--target web` is the important flag. It emits an ES module you `import`
directly from a plain `<script type="module">` — no bundler, no npm install, no
build step in the browser. The output lands next to the HTML:

```
www/pkg/
  gfarena0_web_bg.wasm     # the compiled engine
  gfarena0_web.js          # generated glue: string marshalling, init()
  gfarena0_web.d.ts        # TypeScript types + your Rust doc comments
  package.json
```

You never edit these. `www/pkg` is in `.gitignore` and gets rebuilt on every CI
run. The `.d.ts` file is worth reading, though — wasm-bindgen copies your Rust
doc comments into it, so it is the honest API reference for the border.

> **Release vs debug.** `make build` is the debug build: fast to compile, fat
> `.wasm`. `make build-release` adds `--release` and is what CI ships. Use debug
> locally, always deploy release.

---

## Step 4 — Import it and await init before touching anything

The generated JS has a default export — the initializer — plus one named export
per `#[wasm_bindgen]` function. Calling a named export before `init()` resolves
will throw, so the whole app starts inside one `async main()`.

`www/index.html`:

```html
<script type="module">
  import init, { arena_version, new_human_vs_bots_game, get_human_state,
                 act, step_bot, collect_game, get_collection_yaml,
                 audit_current_game }
    from './pkg/gfarena0_web.js';

  async function main() {
    await init();                      // fetches + instantiates the .wasm
    document.getElementById('sc-version').textContent =
      'gfarena0 v' + arena_version();  // proof the module is live
    // ... wire up buttons ...
    startGame();
  }
  main().catch(err => console.error('Fatal init error:', err));
</script>
```

Under the hood `init()` resolves `new URL('gfarena0_web_bg.wasm',
import.meta.url)`, fetches it, and instantiates it. That relative URL is why the
folder layout matters: keep `pkg/` beside `index.html` and it just works.

Printing the version into the footer is a cheap, permanent smoke test. If the
page shows a version, the WASM module loaded.

---

## Step 5 — Talk across the border in JSON, and only in JSON

Every exported function takes strings and returns a string. The JS side parses
it. That is the entire protocol.

```js
function startGame() {
  var json  = new_human_vs_bots_game('Standard', 'You', 3, Date.now());
  state = JSON.parse(json);
  if (state.error) { setStatus('Error: ' + state.error); return; }
  render();
}

// A human asks another player for a rank
var event = JSON.parse(
  act(JSON.stringify({ Ask: { target: targetIdx, rank: selectedRank } }))
);

// A bot takes its turn; Rust decides what the bot does
var result = JSON.parse(step_bot());   // {"done":false,"event":{...}}

// Re-read the world after any change
state = JSON.parse(get_human_state());
```

### Three conventions that keep this sane

- **Errors are data, not exceptions.** Every function can return
  `{"error": "..."}`. JS checks `state.error` after each parse instead of
  wrapping calls in try/catch.
- **There is one read function.** `get_human_state()` always returns the world
  from player 0's seat, so the human's hand stays visible during bot turns. The
  UI never accumulates state; it re-renders from a fresh snapshot.
- **Rust owns the loop position.** `step_bot()` returns `{"done":true}` when it
  is the human's turn. JS just keeps calling it on a timer and stops when told.

### Getting a file out of WASM

Same trick, one step further. Rust serialises the match history to YAML text; JS
wraps that text in a `Blob` and clicks a synthetic link.

```js
var yaml = get_collection_yaml();      // raw YAML, or a JSON error object
var blob = new Blob([yaml], { type: 'application/yaml' });
var url  = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = url;
a.download = 'gf-history-' + Math.floor(Date.now() / 1000) + '.yaml';
a.click();
URL.revokeObjectURL(url);
```

> **The one ambiguity to handle.** YAML is a superset of JSON, so a successful
> YAML payload can sometimes parse as JSON. The download handler tries
> `JSON.parse` first and only bails if the result has an `.error` key; a parse
> failure means it is real YAML and the download proceeds.

---

## Step 6 — Serve it over HTTP, not from the filesystem

```bash
make serve      # builds, then: cd www && python3 -m http.server 8080
make kill       # frees port 8080 when you are done
```

Opening `index.html` with a `file://` URL will not work. ES modules and
`fetch()` both need a real origin, and the server has to send `.wasm` as
`application/wasm`. Any static server does this; Python's built-in one is
enough.

---

## Step 7 — Build the WASM in CI and upload the folder

There is no server to deploy — the artifact is just `www/` after a release
build. The GitHub Actions job installs the toolchain, builds, and hands the
folder to Pages.

`.github/workflows/deploy.yml`:

```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    targets: wasm32-unknown-unknown      # easy one to forget

- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

- name: Install wasm-pack
  run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

- name: Build WASM (release)
  run: wasm-pack build --release --target web --out-dir www/pkg

- uses: actions/upload-pages-artifact@v3
  with:
    path: www/                           # pkg/ is inside, freshly built
```

Cache `~/.cargo` and `target/` or every push pays a full cold Rust compile.

---

## Step 8 — Test the real module in a real browser

Unit-test the rules inside gfcore with ordinary `cargo test`. Test the wiring
with Playwright against the served page, so the assertion covers the actual
compiled `.wasm`.

```bash
make test        # build + npx playwright test (headless)
make test-ui     # interactive runner
make ayce        # clean + build + test, the full pass
```

One detail worth copying: the page reads a query flag and drops its 2-second bot
animation delay to zero.

```js
const BOT_DELAY = new URLSearchParams(location.search).has('fast') ? 0 : 2000;
```

Tests load `/?fast` and a full four-player game runs in milliseconds, with no
`waitForTimeout` guesswork in the specs.

---

## Reference — things that bite

| Symptom | Cause and fix |
|---|---|
| Blank page, module error in console | Opened over `file://`. Serve it: `make serve`. |
| `pkg/` missing after clone | Generated output, gitignored on purpose. Run `make build`. |
| CI fails linking | Missing `targets: wasm32-unknown-unknown` in the toolchain step. |
| Rust panic vanishes silently | gfcore exports `wasm_init()`, which installs `console_error_panic_hook` so panics surface in the browser console. |
| Function exists in Rust, missing in JS | Not marked `#[wasm_bindgen]`, or behind a feature flag that is off. Check `features` in `Cargo.toml`. |
| New engine behaviour not showing | Stale `pkg/`. `make clean && make build`, and bump the `gfcore` version. |

---

## Recap — the seven-line version

1. Depend on the Rust library; set `crate-type = ["cdylib"]`.
2. Keep the shim crate empty — exports live in the engine.
3. `wasm-pack build --target web --out-dir www/pkg`.
4. `import init, { … } from './pkg/<name>.js'`, then `await init()`.
5. Send JSON strings across; parse on the JS side; keep state in Rust.
6. Serve `www/` over HTTP; deploy the same folder to Pages.
7. Drive the real browser in tests, with a fast-mode flag.

---

*Written from the gfarena source at v0.0.7 —
<https://github.com/ImperialBower/gfarena>*
