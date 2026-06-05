# TreeFit

TreeFit is a browser-based procedural SVG generator for CNC-ready “tree of life” artwork fitted inside a circular boundary. The MVP uses React, TypeScript, Vite, direct browser-rendered SVG, and a pure deterministic TypeScript generator that is independent from React.

## Setup

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The app runs fully in the browser and does not require a backend.

## Scripts

```bash
npm install
npm run dev
npm test
npm run build
```

- `npm run dev` starts the interactive web UI.
- `npm test` runs Vitest coverage for deterministic generation, geometry constraints, and SVG export.
- `npm run build` type-checks and builds the production bundle.

## Parameters

- **Canvas size**: SVG viewport size in pixels.
- **Circle radius**: boundary radius. The UI clamps this so it fits inside the canvas.
- **Seed**: text or number used by the seeded PRNG. The same seed and parameters produce the same segment list.
- **Branch density**: increases canopy bifurcation, twig detail, and overall branch count.
- **Root density**: separately increases root bifurcation and rootlet count.
- **Max branch depth / max root depth**: recursion limits for upward branches and downward roots.
- **Trunk thickness**: base stroke thickness for the central trunk.
- **Minimum branch thickness**: taper stop threshold and lower stroke bound.
- **Branch/root balance**: biases generated length and emphasis between canopy and roots.
- **Curvature**: controls cubic Bézier bend intensity.
- **Organic jitter**: adds deterministic noise to angles and controls.
- **Boundary margin**: keeps generated geometry away from the circle edge.
- **Minimum feature size**: suppresses tiny or degenerate CNC-unfriendly segments.
- **Simplify tolerance**: reserved for future outline/polyline simplification paths.
- **Render mode**: stroke mode is implemented; outline mode is available in the UI and falls back to stroke with a warning.
- **Layer toggles**: show/hide mask, roots, bark detail, and leaves.

## Architecture

The generation pipeline is in `src/lib/generator.ts` and has no React dependency. It accepts a serializable `TreeParams` object and returns a serializable `TreeModel`, which can be used by:

- main-thread preview generation,
- the included Web Worker wrapper,
- a future backend endpoint such as `POST /generate-svg`.

Geometry uses a centered coordinate system with `(0, 0)` at the center of the SVG. Positive `y` points downward, matching SVG coordinates. Circle-constrained output is created with the `Mask` abstraction, currently implemented by `CircleMask`.

## CNC usage notes

- Export is pure vector SVG: no raster images are embedded.
- The SVG contains named groups: `mask`, `roots`, `trunk`, `branches`, `bark_detail`, and `leaves`.
- Stroke mode uses rounded cubic Bézier paths suitable for laser engraving, plotting, and simple toolpath workflows.
- Keep **minimum feature size** above your tool kerf or bit diameter.
- Increase **boundary margin** when cutting close to stock edges or frames.
- Watch the path-count status warning; very dense artwork can slow CAM import.
- Outline mode is intentionally marked as a future-ready fallback until filled tapered outlines are implemented.

## Roadmap

### Phase 2: custom masks

The `Mask` interface is ready for additional boundary shapes:

- star,
- heart,
- rounded rectangle,
- imported SVG path,
- polygon mask.

For non-circle masks, branch and root endpoints can seek directionally appropriate boundary points while projection keeps geometry inside the shape.

### Phase 3: richer tree styling

Planned styling improvements include better bark contour lines, knots and whorls, hatching, root hairs, leaf clusters, pruning controls, symmetry/asymmetry controls, and independent layer export.
