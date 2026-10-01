# Adaptive Layout Engine for Multi-Surface Ads

A production-grade, constraint-based layout engine built in **pure TypeScript**, designed to dynamically adapt declarative ad specifications across wildly heterogeneous display surfaces—without relying on CSS media queries or hardcoded per-surface switch statements.

Built for the **Flam Assignment**.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm** or **pnpm** or **yarn**

### 2. Installation & Running Locally
```bash
# Clone the repository
git clone https://github.com/Vedansh-Mittal/FlamProject.git
cd FlamProject

# Install dependencies
npm install

# Run the Next.js development server
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser to access the interactive dashboard.

### 3. Run Automated Constraint Verification Tests
```bash
# Runs the 20-point constraint and collision test suite
npm test
```

---

## 🧭 Live Demo & Interactive Features

The dashboard includes a full suite of interactive tools to inspect, stress-test, and verify the engine:

1. **Surface Switcher**:
   - 📱 **Mobile Portrait** (320 × 480, safe areas, 44px min tap target)
   - 📱 **Mobile Landscape** (480 × 320, 45/55 media-copy split)
   - 📺 **Broadcast Lower-Third** (1920 × 250, 32px minimum text size, far viewing distance)
   - 🖥️ **Retail Kiosk** (1080 × 1080, 60px min touch target, balanced quadrant grid)
   - ⌚ **Smart Watch / Wearable (5th Surface)** (280 × 280, micro-display adaptation)
   - 🛠️ **Custom Surface Generator**: Real-time sliders for width, height, viewing distance, and touch modalities.

2. **Live Space-Degradation Slider**:
   - Drag the slider from **100% down to 35% available space** to witness deterministic priority-based degradation in real time:
     - **Stage 1**: Inter-element spacing compresses.
     - **Stage 2**: Priority 3 Branding Logo shrinks, then drops out cleanly.
     - **Stage 3**: Priority 2 Price condenses/truncates to preserve vertical room.
     - **Stage 4**: Priority 1 Headline and Hero Image scale cleanly without clipping or collision.

3. **Dual Rendering Engines (DOM vs. Canvas)**:
   - Toggle between **DOM (GPU-accelerated absolute translation)** and **Canvas (HTML5 2D Context)** to demonstrate complete engine decoupling.

4. **Side-by-Side Diagnostics Inspector**:
   - **Boxes Tab**: Real-time bounding box table with exact $(x, y, w, h)$ coordinates, font sizes, and tap target compliance.
   - **Audit Log Tab**: Chronological trace of Pass 3 degradation decisions.
   - **JSON Tabs**: Raw resolved layout payload and input `AdSpec`.
   - **API Test Tab**: Live interactive runner dispatching `POST /api/resolve` against the backend.

---

## 📐 The Constraint Resolution Algorithm

### Step-by-Step Resolution Flow
$$\text{AdSpec} + \text{SurfaceProfile} \xrightarrow{\text{resolver.ts}} \text{ResolvedLayout JSON} \xrightarrow{\text{render-dom.ts / render-canvas.ts}} \text{Rendered Ad}$$

The engine operates in **four discrete, deterministic passes**:

### Pass 1: Macro-Topology & Axis Selection
Computes safe usable dimensions after deducting physical insets ($W_{\text{safe}} = W - \text{left} - \text{right}$, $H_{\text{safe}} = H - \text{top} - \text{bottom}$) and evaluates the continuous aspect ratio ($AR = \frac{W_{\text{safe}}}{H_{\text{safe}}}$):
- **$AR \ge 3.0$ (Ultra-Wide Strip):** `cinema-wide-strip` — Content aligns horizontally in a single-line ribbon.
- **$1.4 \le AR < 3.0$ (Landscape Viewport):** `horizontal-split` — Content divides into a 45% media column and a 55% copy/action column.
- **$0.85 \le AR < 1.4$ (Square / Kiosk):** `multi-column-grid` — Balanced vertical quadrant placement with centered hero media.
- **$AR < 0.85$ (Portrait / Mobile):** `vertical-stack` — Ergonomic top-to-bottom stack with CTA anchored in thumb reach.

*Note: No surface names are checked in this pass. Any arbitrary width/height combination naturally flows into its optimal geometric envelope.*

### Pass 2: Hard Constraint Derivation
1. **Viewing Distance Typography Scaling:**
   - `"far"` ($>3\text{m}$): Typography multiplied by $2.2\times$, enforcing $\ge 32\text{px}$ floor for legibility across a room.
   - `"medium"` ($\sim 1\text{m}$): Multiplied by $1.35\times$.
   - `"near"` ($\sim 30\text{cm}$): $1.0\times$ standard reading baseline.
2. **Touch Target Enforcement:**
   - If `touchOnly === true`, action buttons enforce `minTapTarget` ($\ge 44\text{px}$ for mobile, $\ge 60\text{px}$ for standing kiosks).

### Pass 3: Priority-Based Degradation Loop
When content bounding boxes exceed safe viewport bounds, the engine executes a deterministic relaxation cascade:

| Priority Tier | Element Role | Degradation Strategy |
| :---: | :---: | :--- |
| **All** | Spacing / Margins | Inter-element gaps compress from $18\text{px} \to 12\text{px} \to 8\text{px} \to 4\text{px}$. |
| **Priority 3** | Logo / Branding | First scales down to $60\%$, then drops completely (`visible: false`). |
| **Priority 2** | Price / Secondary | Truncates to compact price string; compresses font size down towards minimum text floor. |
| **Priority 1** | Hero Image | Constrained to intrinsic aspect ratio, scales down towards minimum allowable dimensions ($90\times 70\text{px}$). |
| **Priority 1** | Headline | Font size reduces towards `minTextSize`; line count clamped. |
| **Priority 2** | Action CTA | Maintained with required `minTapTarget` height. |

*Every degradation event is logged to `diagnostics.pass3DegradationSteps`.*

### Pass 4: Box Packing & Collision Prevention
- Assigns exact integer pixel coordinates $(x, y)$ within the safe area.
- Runs an Axis-Aligned Bounding Box (AABB) intersection check across all visible elements to mathematically guarantee zero overlap ($0$ collisions).

---

## 🔒 TypeScript Type System Design

All element definitions, semantic roles, constraints, and surface profiles are strictly typed to make invalid combinations unrepresentable:

- **Discriminant Element Types**:
  ```ts
  type ElementType = "text" | "image" | "button";
  ```
- **Role-to-Type Mapping**:
  ```ts
  type RoleForType<T extends ElementType> = 
    T extends "text" ? ("primary" | "secondary" | "legal" | "eyebrow") :
    T extends "image" ? ("hero" | "branding" | "background") :
    T extends "button" ? ("action" | "secondary-action") : never;
  ```
- **Builder with Runtime & Compile-time Verification**:
  `defineAd(...)` validates uniqueness of element IDs, verifies that font constraints are logically coherent (`minFontSize <= maxFontSize`), and asserts that at least one Priority 1 element exists.

---

## ⚖️ Design Tradeoffs & Decisions

1. **Analytical Greedy Relaxation vs. General Linear Programming (Simplex):**
   - *Decision*: Implemented a deterministic, multi-pass greedy relaxation algorithm instead of an LP solver (e.g., Cassowary/Simplex).
   - *Rationale*: LP solvers introduce substantial bundle overhead and can oscillate or produce unpredictable, non-explainable fractional layouts. A priority-ordered cascade runs in **$<0.2\text{ms}$**, is $100\%$ explainable, and guarantees deterministic degradation order.

2. **Absolute Pixel Placement vs. Delegated CSS Flexbox:**
   - *Decision*: The resolver computes explicit `{ x, y, width, height }` values in pixels.
   - *Rationale*: Computing coordinates in pure TypeScript decouples the engine entirely from the DOM, enabling headless API execution, Canvas rendering, and deterministic collision testing.

3. **Character-Metric Text Estimation vs. DOM Measurement:**
   - *Decision*: Utilized deterministic character-ratio typographic modeling within the pure resolver.
   - *Rationale*: Running `document.createElement` inside the resolver would break Node.js server-side execution (`/api/resolve`). Pure mathematical estimation ensures the engine remains truly framework-agnostic.

---

## ⚠️ Known Limitations & Future Work

1. **Complex Multi-Line Text Wrapping**:
   - Currently uses typographic character metrics ($\sim 0.58\times$ font size). In a production cluster, a headless canvas font metric cache (e.g., via `skia-canvas` on Node) could provide sub-pixel text measurement.
2. **Fixed Element Types**:
   - Supports text, images, and action buttons. Extending to video players, carousel sliders, and countdown timers would follow the same `BaseElementSpec` interface.
3. **Advanced Flow Alignment**:
   - Currently supports left-to-right, vertical centering, and column split. Can be extended to support bidirectional internationalization (RTL).

---

## ⏱️ Time Spent on Assignment

- **Architecture & Schema Design**: ~3 hours
- **Core Algorithmic Resolver (`resolver.ts`)**: ~5 hours
- **DOM & Canvas Renderers (`render-dom.ts`, `render-canvas.ts`)**: ~3 hours
- **Interactive UI Dashboard & Live Degradation**: ~4 hours
- **Testing, API Routes, & Documentation**: ~3 hours
- **Total Time**: ~18 hours

---

## 🤖 AI Tools Disclosure

As required by the assignment guidelines:
- **AI Tool Used**: Gemini / Antigravity Agent.
- **Usage**: Used for rapid prototyping of layout math, generating initial test cases, formulating Mermaid architecture diagrams, and verifying TypeScript union types. All architectural decisions, constraint passes, and degradation hierarchies were intentionally designed and verified for this challenge.
