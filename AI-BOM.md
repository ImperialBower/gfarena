# AI Bill of Materials — gfarena

This document discloses the AI tools used during the development of `gfarena` and describes the scope of their involvement and the human oversight applied.

---

## Tools Used

| Tool | Provider | Interface | Model |
|------|----------|-----------|-------|
| Claude Code | Anthropic | CLI / claude.ai/code | Claude Sonnet 4.6 |

---

## Scope of AI Assistance

### Substantially AI-assisted
- **Rust WASM bindings** (`src/`) — wasm-bindgen interface, game state serialisation, public JS API
- **Frontend** (`www/index.html`) — HTML structure, CSS layout and dark-mode styling, JavaScript game loop and render logic
- **CI/CD configuration** — GitHub Actions workflows (deploy to GitHub Pages, Playwright test runner)
- **Test suite** — Playwright end-to-end tests (`tests/`)

### Human-driven
- Project vision: browser-playable Go Fish, human vs. bots
- UX decisions: interaction model, bot delay, game parameters
- Architecture: choice of gfcore as the game engine dependency, WASM target design
- All code review — every AI-generated change was reviewed and accepted or rejected by the human author before commit
- Git workflow: branching, commit messages, release decisions

---

## Human Oversight

All AI output was reviewed interactively via the Claude Code CLI before being staged or committed. The human author retained final decision authority on all design choices, public API surfaces, and accepted changes. No AI-generated code was merged without review.

---

## Notes

- The core game engine (`gfcore`) is a separately maintained dependency; its own AI involvement is documented in that package's `AI-BOM.md`.
- AI tools were used from project inception (2026-05-08).
