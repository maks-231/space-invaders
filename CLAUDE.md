# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Two separate things live here:

1. **`main.py`** — a one-off script that drives the Claude Agent SDK (`claude_agent_sdk.query`) with a hardcoded prompt to *generate* a Space Invaders game into the current working directory. It is the generator, not the game.
2. **`index.html` / `game.js` / `style.css`** — the generated output: a self-contained, dependency-free Space Invaders clone. This is almost certainly what you'll be asked to modify (fix a bug in the game, tweak difficulty, add a feature, etc.).

Don't confuse edits to the game with edits to the generator — changing `main.py`'s prompt does not change the already-generated game files, and running `main.py` again will overwrite `index.html`/`game.js`/`style.css` with a fresh, non-deterministic LLM-generated rewrite.

## Commands

Dependency management uses `uv` (see `uv.lock`, `pyproject.toml`, `.python-version` pinned to 3.13.5).

```bash
uv sync            # install/update deps into .venv
uv run main.py      # regenerate the game via the Claude Agent SDK (overwrites index.html/game.js/style.css)
```

There is no build step, bundler, linter, or test suite for the game itself — it's plain HTML/CSS/JS served directly from the filesystem (open `index.html` in a browser, or serve the directory with any static file server).

`main.py` loads a `.env` file via `python-dotenv` — the Claude Agent SDK call requires Anthropic API credentials to be available in the environment for `uv run main.py` to work.

## Game architecture (`game.js`)

Single IIFE, no modules/build step, no external libraries — everything (state, input, physics, rendering, audio) lives in this one file.

- **`state`** is the single mutable object holding the entire game: `mode` (`menu`/`playing`/`paused`/`over`), `score`/`lives`/`level`, `player`, `bullets`/`enemyBullets`/`particles` arrays, `invaders`, `shields`, invader `dir`/`frame`/`moveTimer`, `ufo`, and background `stars`. `reset()` rebuilds it from scratch.
- **Game loop**: `requestAnimationFrame` drives `loop()` → `update()` (physics/logic, no-ops unless `mode === "playing"`, though particles/stars still animate in any mode) → `draw()` (pure canvas rendering from `state`, no side effects).
- **Invaders** are a flat array of `{x, y, row, alive}`; movement speed and enemy fire probability scale with how many are left alive and the current `level` (classic "faster as you clear them" Space Invaders behavior).
- **Shields** are destructible pixel grids: each cell is an independent `{x, y, hp}` entry generated procedurally in `makeShields()` (arch cut out, rounded top corners), decremented/removed on collision, including splash damage to neighboring cells.
- **Collision** is a single generic AABB `hit(a, b)` helper reused for bullets vs. invaders, UFO, shields, player, and invaders vs. shields/ground.
- Sprites are hand-authored bitmaps (`SPRITES`, 11x8 strings of `0`/`1`) scaled by `PX`; `drawSprite` just fills rects per `1` cell. Animation alternates frames by horizontally flipping rows.
- Score, level, lives, and high score (persisted in `localStorage` under `si-hi`) are mirrored into the DOM via `updateHud()`.
- Input: keyboard (arrows/A/D/space/P/Enter) and on-screen touch buttons both funnel into the same `keys` map that `update()` reads — any new input method should follow this pattern rather than acting directly on `state`.
- Audio is synthesized on the fly via `beep()` (Web Audio oscillator), not sample-based — there are no audio assets.
