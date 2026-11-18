# AGENTS.md

Instructions and architectural reference for AI coding agents working on **Pixelsoup**, an
open-source, layered raster image editor that runs entirely in the browser.

Read [CLAUDE.md](CLAUDE.md) and the domain docs in [`docs/`](docs/) alongside this file before
making changes. Keep `CLAUDE.md` under 200 lines whenever updating it.

---

## 1. Git & Pull Request Workflow

- **Branching**: `main` must always lint, test, and build cleanly. Never commit directly to
  `main`. All work happens on `feat/*`, `fix/*`, or `chore/*` branches and lands via pull
  request.
- **Commits**: Make small, self-contained, reviewable commits ordered logically (e.g. core
  model/math + unit tests → commands → UI components/tools → docs). Do not mix refactors with
  feature changes, and ensure every commit builds and passes tests on its own.
- **No unrequested git mutations**: Do not commit, push, merge, rebase, or switch branches
  unless explicitly asked by the user.
- **Verification gate**: Before declaring any task complete, run:
  1. `npm run format`
  2. `npm run lint`
  3. `npm test`
  4. `npm run build`
  5. Browser verification (`npm run dev` or `npm run preview` at `http://localhost:1619`) for
     any UI, canvas, or interaction change.
- **PR summaries**: Pull request write-ups live in `docs/PR/<branch-name>.md` and follow the
  established sections: `Summary`, `What's included` (numbered commit breakdown),
  `Design notes`, `How to verify` (test counts, unit-test coverage, headless browser checks, and
  a `- [ ]` manual checklist), `Known limitations`, and `Deliberately out of scope`.

---

## 2. Tech Stack & Environment Constraints

| Area              | Choice & Rules                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Language**      | TypeScript (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)                 |
| **Build / Dev**   | Vite **7** on port `1619` (`strictPort: true`). Production builds inject a strict meta CSP.                             |
| **UI**            | React 19 for menus, toolbar, tool options, dialogs, and layer panel                                                     |
| **Viewport**      | Imperative HTML5 Canvas 2D + WebGL 2 marching ants (`GlAnts` with 2D fallback); no React on the pointer/render hot path |
| **Tests**         | Vitest in Node (`src/core` runs without a DOM; UI tools test against `FakeViewport` and `FakeClock`)                    |
| **Lint / Format** | ESLint 10 (type-checked `typescript-eslint`) + Prettier (single quotes, 100 cols, LF)                                   |
| **Node.js**       | `^22.13.0 \|\| ^24.0.0 \|\| >=26.0.0` (`.nvmrc` specifies `22`)                                                         |

### Hard Constraints

- **Minimal dependencies**: Only `react`, `react-dom`, and `fflate` are runtime dependencies.
  **Ask the user before adding any package.**
- **No-Rust / AppLocker constraint**: No Rust toolchain or Tauri may be required. On the
  development Windows machine, AppLocker blocks unsigned `.exe` binaries (which is why Electron
  was dropped and Vite stays on version 7 rather than Rolldown/Oxc). Prefer pure TypeScript/JS.
- **Colour space**: 8-bit sRGB (`Uint8ClampedArray` / `Uint8Array`), straight
  (non-premultiplied) alpha (`Rgba` / `PixelBuffer`). No ICC profiles, linear-light blending, or
  high bit depth.

---

## 3. Commands

| Command             | Purpose                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run dev`       | Start Vite dev server at `http://localhost:1619`                                                       |
| `npm run build`     | Run `tsc -b` across `tsconfig.core.json`, `tsconfig.web.json`, `tsconfig.node.json`, then `vite build` |
| `npm run preview`   | Serve production `dist/` at `http://localhost:1619`                                                    |
| `npm test`          | Run all Vitest unit tests once (`npm run test:watch` for watch mode)                                   |
| `npm run lint`      | Run ESLint and `prettier --check .`                                                                    |
| `npm run format`    | Format repository with Prettier (`prettier --write .`)                                                 |
| `npm run typecheck` | Run `tsc -b` project references check only                                                             |

---

## 4. Architecture & Core Invariants

### 4.1 Strict `src/core/` vs `src/ui/` Boundary

- **`src/core/`** contains pure document, pixel, geometry, selection, command, history,
  compositor, paint, resample, and `.soup` serialization logic. It must have **zero** DOM,
  React, Node, or browser globals. This is enforced both by `tsconfig.core.json` (`"lib": ["ES2023"]`,
  `"types": []`) and by `eslint.config.js`.
- **`src/ui/`** contains React components, the imperative viewport, tools, sessions, clipboard,
  and browser I/O. UI code imports core exclusively through the barrel `src/core/index.ts`.
  Neither `src/core/` nor `src/ui/` may import `node:*` APIs.

### 4.2 Document, Layers & Coordinates

- **Coordinates**: Document space is measured in pixels from the canvas top-left `(0, 0)` to
  `(width, height)` (1–8192 px, `MAX_IMAGE_SIZE`). Pixel `(px, py)` spans `[px, px + 1) ×
[py, py + 1)`. A raster layer's integer offset `(x, y)` maps layer space to document space
  and may be negative or extend past the canvas. The viewport maps document coordinates to CSS
  pixels via `screen = doc * zoom + pan`.
- **Layer stack**: `doc.layers[0]` is the bottom layer; the Layer panel renders the stack
  reversed so the top layer is listed first.
- **Layer union**: `Layer` is a discriminated union on `kind` (currently `RasterLayer`). Every
  `switch (layer.kind)` must end with `assertNever(layer)`.
- **Layer IDs**: `createLayerId(doc)` allocates `layer-1`, `layer-2`, … and advances
  `doc.nextLayerNumber`. Never call command factories that allocate a layer ID (`newLayerCommand`,
  `duplicateLayerCommand`, `layerViaCopyCommand`, `layerViaCutCommand`, `pasteCommand`) inside
  read-only availability checks such as `canRunLayerAction`.

### 4.3 Selection Clipping Invariant

- `doc.selection` is either `null` (everything editable) or a non-empty canvas-sized 8-bit
  coverage mask (`Selection`, `0`–`255`). `SetSelectionCommand` normalizes an empty mask to
  `null` and sets `changesContent: false` (selection changes are undo steps, but do not mark the
  document dirty and are not saved in `.soup`).
- **Clipping rule**: Every pixel-editing command (Brush, Eraser, Fill, Clear, Paint Bucket,
  Lift/Copy Selection, Layer via Copy/Cut, Clipboard Cut/Copy) **must** clip to `doc.selection`
  when non-null, weighting its effect per pixel by `coverage / 255`:
  $$\text{result} = \text{old} + (\text{new} - \text{old}) \times \frac{\text{coverage}}{255}$$
- Whole-layer operations (Move Layer, Free Transform, Orient Layer, Merge Down, Flatten, layer
  visibility and opacity) and canvas-wide operations (Crop, Canvas Size, Image Size, Orient
  Canvas) are not pixel edits and do not weight by selection coverage.

### 4.4 Command-Based History, Snapshots & `layerPixels`

- **All mutations are `Command`s**: Nothing may mutate `ImageDocument` outside
  `editor.history.execute(cmd)`. Command factories return `null` when an operation would be a
  no-op.
- **Gesture merging**: Continuous interactions (Move drags, arrow-key nudges within 1 s,
  Brush/Eraser strokes, opacity slider drags) pass a shared `mergeKey` so a whole gesture merges
  into a single undo step.
- **Undo storage**:
  - Bounded pixel edits capture a `PixelSnapshot` of the affected layer-space rect before writing
    and restore it byte-for-byte on `revert`.
  - Brush and Eraser strokes store original pixels and coverage in sparse 64×64 tiles
    (`StrokeMask`). Within a stroke, dabs combine by **maximum** (`Math.max`), and each frame
    repaints from the saved original tiles so overlapping dabs never exceed the stroke's opacity
    or accumulate rounding error.
  - Operations that grow a layer (`growthArea`, capped at the canvas if the union exceeds 8192 px
    on a side), Merge Down, Flatten, Image Size, and layer transforms retain the old and new
    `PixelBuffer`s.
- **`DocumentChange.layerPixels` contract**: Every command that alters a layer's pixel buffer on
  `apply` or `revert` **must** include `{ layerId, rect }` (or `rect: null` when the buffer was
  replaced/resized) in `DocumentChange.layerPixels`, otherwise `LayerThumbnails` will not redraw
  that layer's thumbnail.

### 4.5 Session State, Floating Selections & Pending Edits

- **Session state** (never saved in `.soup`, not history steps in themselves):
  - `editor.activeLayerId`: Always points to an existing layer while layers exist; `Editor`
    automatically repairs it to the layer below (or above) when its layer is deleted or merged.
  - `editor.floating` (`FloatingSelection`): Created when the Move tool or Free Transform lifts
    selected pixels into a temporary `"Floating selection"` layer directly above its source.
    While floating, its layer is active and cannot be reordered, renamed, hidden, or faded. If
    committed unmoved and unedited (`!floating.edited`), `CommitFloatingCommand` restores the
    source's lifted `PixelSnapshot` for a bit-identical round trip.
  - `editor.pending` (`PendingEdit`): A modal canvas session such as Free Transform
    (`TransformSession`, started via `ToolManager.startSession` and `editor.beginPending`) that
    previews on the overlay without touching the document until applied.
  - Tool choices, tool options, `Colors` (foreground/background), `PixelClipboard`, and
    `ViewOptions` (`showExtras`).
- **Commit / Apply order before actions**:
  1. Any action that mutates the document, changes the active layer, switches tools, or saves/
     exports/replaces the document **first applies `editor.pending`** (`editor.applyPending()`),
     whereas `Undo` cancels the pending edit (`editor.cancelPending()`).
  2. Any action that would alter the floating selection's source layer, change the selection,
     switch away from the Move tool, or save/export **commits `editor.floating`** first as its
     own undo step (`editor.commitFloating()`).

### 4.6 Compositing, Resampling & Preview Performance

- **Compositing**: `CpuCompositor` blends visible layers bottom-up in premultiplied float space
  and outputs straight-alpha RGBA8 for dirty rects only. `compositeLayers` runs the same
  compositor on a pair/subset of layers for Merge Down, Flatten, Copy Merged, and floating
  selection commits.
- **Premultiplied resampling**: `resizePixels` and `transformPixels` (`Affine` or `Projective`)
  always weight RGB by alpha (`Σw·a·c / Σw·a` via `storePremultiplied`, rounding halves up) so
  transparent neighbours never darken anti-aliased edges. When `isAffine(matrix)` is true,
  `transformPixels` and `transformMask` delegate to the affine sampler so affine results stay
  bit-identical.
- **Free Transform preview**: `CompositeRenderer.suppress(layerId)` (`SplitCompositor`) splits
  the composite into layers below and above the active layer. `SelectionOverlay` draws the
  transformed layer between them from a `CanvasPyramid` (halved mip levels to avoid Chromium's
  slow per-frame mipmap regeneration)—as a single `drawImage` for parallelograms, or an adaptive
  `8×8` to `32×32` triangle mesh (`PreviewMesh` in `projective-mesh.ts`, spaced in $1/\sqrt{w}$)
  for non-affine perspective/distort quads.
- **Marching ants**: Below ~67 % zoom, `downsampleSelection` reduces the mask to ~1 CSS-px cells
  before tracing (`AntsOutlineCache`), loops shorter than 16 CSS px hold still
  (`STATIC_LOOP_LENGTH`), and `GlAnts` renders the outline as instanced quads in WebGL 2 (falling
  back to 2D canvas + `AntPhaseCache` when WebGL 2 is unavailable).

### 4.7 File I/O & User Activation

- `.soup` files are zip archives (`fflate`) containing `document.json` (`formatVersion: 1`) and
  stored `layers/<id>.png` files encoded with the custom lossless straight-alpha PNG codec in
  `src/ui/io/png.ts` (never canvas `toDataURL`/`toBlob`, which premultiplies and loses precision).
- `FileStore` (`src/ui/io/file-store.ts`) abstracts the File System Access API and the
  `<input type="file">` / download fallback. Because browser file pickers require transient user
  activation, `FileStore.open` and `FileStore.saveAs` must be invoked **synchronously** inside
  the user's click/key handler before any `await` or heavy encoding work (encoding happens inside
  the lazy `data()` callback after the handle is picked).

### 4.8 Input Routing (`ViewportController`, `ToolManager`, Shortcuts)

- **Pointer**: `ViewportController` handles middle-click pan, `Space`+drag pan, and wheel zoom
  first. Primary-button presses (`button === 0`, excluding Mac `Ctrl`+click) go to
  `ToolManager`. Right-clicks (`isContextClick`) never reach tools; over the canvas they open
  `CanvasMenu`.
- **Keyboard priority**: `ViewportController` listens for `keydown` on `document`, while global
  shortcut hooks (`use-*-shortcuts.ts`) listen on `window`. If the active tool or session
  handles a key (e.g. `Backspace` removing a Polygonal Lasso vertex, or `Escape` cancelling a
  drag/outline), it returns `true`, the viewport calls `e.preventDefault()`, and window
  shortcuts skip it (`e.defaultPrevented`).
- **Blocked gate**: While a modal dialog is open or a file operation is running
  (`controller.blocked`), all tool keys and global shortcuts are suppressed so `Enter`,
  `Escape`, and text entry belong solely to the dialog.

---

## 5. Coding & Testing Conventions

- **Formatting**: Run `npm run format` before finishing. Prettier enforces single quotes, 100
  columns, trailing commas, and LF line endings.
- **Imports**: Always use `import type` for type-only imports (`verbatimModuleSyntax`).
- **Naming**: `kebab-case.ts` for non-component modules, `PascalCase.tsx` for React components,
  and `*.test.ts` colocated next to the module under test.
- **Hot loops**: Use flat typed arrays (`Uint8Array`, `Uint8ClampedArray`, `Float32Array`,
  `Int32Array`) and index arithmetic. Avoid per-pixel object allocations, closures, or
  recursion (e.g. `floodRegion` uses a growable `Int32Array` scanline stack).
- **Comments**: Comment only non-obvious invariants, coordinate spaces, units, or rounding
  arithmetic.
- **Unit tests**:
  - Every new core behaviour requires unit tests in `src/core/**/*.test.ts`.
  - Pixel-math tests must assert exact RGBA bytes worked out by hand, with a short comment
    showing the formula when non-trivial.
  - UI tools and sessions must be tested through `ToolManager` + `FakeViewport`
    (`src/ui/tools/fake-viewport.ts`) and `FakeClock` (`src/ui/tools/fake-clock.ts`).

---

## 6. Documentation Map

| File                                       | Contents                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                     | Concise project overview, architecture summary, folder map, and build roadmap (keep $\le$ 199 lines)                                                                |
| [README.md](README.md)                     | User-facing feature overview, shortcut reference tables, and getting-started guide                                                                                  |
| [docs/file-format.md](docs/file-format.md) | `.soup` zip container, `document.json` schema, validation rules, and versioning policy                                                                              |
| [docs/layers.md](docs/layers.md)           | Active layer rules, floating selections, layer commands, dirty rects, `layerPixels`, and Layer panel/menu                                                           |
| [docs/tools.md](docs/tools.md)             | `Selection` masks, `Tool` & `ToolSession` interfaces, input routing, marching ants, painting engine, Fill/Clear/Bucket, Clipboard, Crop, and Free Transform handles |
| [docs/transform.md](docs/transform.md)     | Crop/Canvas Size, lossless turns/flips, premultiplied resampling, `Affine` & `Projective` homographies, and Free Transform quad/mesh preview                        |
| [docs/deploy.md](docs/deploy.md)           | Cloudflare Pages and GitHub Pages (`VITE_BASE=/pixelsoup/`) deployment, headers, CSP, and rollback                                                                  |
| [docs/PR/](docs/PR/)                       | Milestone pull request summaries with design rationale, benchmarks, and verification checklists                                                                     |
