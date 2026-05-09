# gfarena

A browser-based, single-player Go Fish game where one human faces three AI
bots. The game engine is written in Rust, compiled to WebAssembly via
[wasm-pack](https://rustwasm.github.io/wasm-pack/), and served as a single
static HTML page — no server required.

**Live demo:** <https://imperialbower.github.io/gfarena/>

---

## How it works

| Layer | Technology | Role |
|---|---|---|
| Game engine | Rust (`gfcore` crate) | Go Fish rules, bot AI, game history |
| WASM bindings | `wasm-bindgen` | Exposes Rust functions to JavaScript |
| Frontend | Vanilla HTML/CSS/JS | Card display, status log, bot panels |
| CI/CD | GitHub Actions | Build WASM → deploy to GitHub Pages |

All game state lives in Rust `thread_local!` singletons. JavaScript calls a
small set of exported functions (`new_human_vs_bots_game`, `get_human_state`,
`act`, `step_bot`) and receives JSON back — no state is passed back to Rust
from the browser.

---

## Prerequisites

- [Rust](https://rustup.rs/) (stable, ≥ 1.85) with the `wasm32-unknown-unknown` target:

  ```
  rustup target add wasm32-unknown-unknown
  ```

- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/):

  ```
  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
  ```

---

## Building

```bash
# Debug build (fast compile, larger WASM)
make build

# Release build (optimised, smaller WASM — used by CI)
make build-release

# Or invoke wasm-pack directly
wasm-pack build --target web --out-dir www/pkg
```

The output lands in `www/pkg/`. Open `www/index.html` via a local HTTP server
(WASM requires HTTPS or `localhost`):

```bash
make serve
# then open http://localhost:8080
```

---

## Running tests

End-to-end tests use [Playwright](https://playwright.dev/) against the built
WASM.

```bash
# Install Node dependencies and Chromium once
make install-playwright

# Build WASM and run all tests
make test

# Interactive UI mode
make test-ui
```

---

## Gameplay

- You play as **You** against three bots: Harriet, Bertram, and Lucky.
- On your turn, click a card in your hand to select a rank, then pick a bot to ask.
- If the bot has cards of that rank they give them to you and you ask again.
- If not, you're told to **Go Fish** and draw from the pile.
- Each bot's action is shown in the status bar with a 2-second delay so you
  can follow what they asked for and who they asked.
- Complete a **book** (all four cards of a rank) and it moves to your books row.
- The player with the most books when the draw pile runs out wins.

---

## Dependencies

| Crate | Purpose |
|---|---|
| [`gfcore`](https://crates.io/crates/gfcore) | Go Fish engine, bot profiles, game history |
| `wasm-bindgen` | Rust ↔ JavaScript bridge |
| `serde` / `serde_json` | JSON serialisation of game state |
| `console_error_panic_hook` | Rust panics surfaced in the browser console |

---

## License

MIT OR Apache-2.0 — see [LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
