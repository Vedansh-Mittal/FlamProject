/**
 * Core Algorithmic Constraint-Solving Engine (Pure TypeScript, Framework-Agnostic)
 * 
 * Takes a declarative AdSpec and a physical SurfaceProfile, and computes deterministic,
 * pixel-exact bounding boxes without using CSS media queries or per-surface hardcoded branches.
 * 
 * Pipeline:
 * - Pass 1 (Axis & Topology Selection): Aspect ratio & geometric envelope classification.
 * - Pass 2 (Constraint Enforcement): Viewing distance typography scaling, safe-area insets, touch tap-targets.
 * - Pass 3 (Priority-Based Degradation Loop): Deterministic priority-ordered compression, truncation, and dropping.
 * - Pass 4 (Box Packing & Collision-Free Coordinate Resolution): Pixel placement within safe area bounds.
 */

import { AdSpec, AdElementSpec, ElementPriority, ElementType, TextElementSpec, ImageElementSpec, ButtonElementSpec } from "./spec";
import { SurfaceProfile, SafeAreaInsets } from "./surfaces";

export type LayoutMode = "vertical-stack" | "horizontal-split" | "multi-column-grid" | "cinema-wide-strip";

export interface ResolvedElementBox {
  id: string;
  type: ElementType;
  role: string;
  priority: ElementPriority;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  lineHeight?: number;
  truncated?: boolean;
  shrunk?: boolean;
  degradationLevel: number; // 0 = pristine, 1 = condensed, 2 = truncated, 3 = dropped
  dropReason?: string;
  minTapTargetMet?: boolean;
}

export interface LayoutDiagnostics {
  pass1Orientation: LayoutMode;
  aspectRatio: number;
  safeAreaBounds: { x: number; y: number; width: number; height: number };
  viewingDistanceScale: number;
  appliedConstraints: {
    minTapTarget: number;
    minTextSize: number;
    touchOptimized: boolean;
  };
  pass3DegradationSteps: string[];
  packingEfficiency: number; // 0 - 100% of usable safe area
  hasCollisions: boolean;
  resolutionTimeMs: number;
}

export interface ResolvedLayout {
  adId: string;
  surfaceId: string;
  surfaceWidth: number;
  surfaceHeight: number;
  safeBounds: { x: number; y: number; width: number; height: number };
  layoutMode: LayoutMode;
  elements: Record<string, ResolvedElementBox>;
  elementList: ResolvedElementBox[];
  degradedElementIds: string[];
  droppedElementIds: string[];
  diagnostics: LayoutDiagnostics;
}

/**
 * Approximate text bounding box based on character count and font metrics.
 */
function estimateTextDimensions(
  text: string,
  fontSize: number,
  availableWidth: number,
  maxLines: number = 2
): { width: number; height: number; lines: number } {
  const avgCharWidth = fontSize * 0.58;
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth));
  const estimatedLines = Math.min(maxLines, Math.ceil(text.length / charsPerLine));
  const lineHeight = Math.round(fontSize * 1.3);
  const width = Math.min(availableWidth, Math.ceil(Math.min(text.length, charsPerLine) * avgCharWidth));
  const height = estimatedLines * lineHeight;

  return { width, height, lines: estimatedLines };
}

/**
 * Axis-Aligned Bounding Box (AABB) collision checker.
 */
function doBoxesCollide(a: ResolvedElementBox, b: ResolvedElementBox, tolerance: number = 1): boolean {
  if (!a.visible || !b.visible) return false;
  return !(
    a.x + a.width - tolerance <= b.x ||
    b.x + b.width - tolerance <= a.x ||
    a.y + a.height - tolerance <= b.y ||
    b.y + b.height - tolerance <= a.y
  );
}

/**
 * Main Pure TypeScript Resolver function
 */
export function resolveLayout(adSpec: AdSpec, surface: SurfaceProfile): ResolvedLayout {
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  const degradationLog: string[] = [];

  // =========================================================================
  // PASS 1: Geometric Envelope & Macro-Topology Selection
  // =========================================================================
  const safeArea: SafeAreaInsets = surface.safeArea || { top: 16, bottom: 16, left: 16, right: 16 };
  const safeX = safeArea.left;
  const safeY = safeArea.top;
  const safeW = Math.max(80, surface.width - (safeArea.left + safeArea.right));
  const safeH = Math.max(60, surface.height - (safeArea.top + safeArea.bottom));
  const safeBounds = { x: safeX, y: safeY, width: safeW, height: safeH };

  const aspectRatio = safeW / safeH;

  // Topological mode selection strictly derived from aspect ratio continuous spectrum:
  // - Ultra-wide (aspectRatio >= 3.0) -> Cinema Wide Strip / Lower-third banner
  // - Landscape (1.4 <= aspectRatio < 3.0) -> Horizontal Split (media on one side, copy & action on other)
  // - Balanced / Square (0.85 <= aspectRatio < 1.4) -> Multi-Column / Quadrant Grid
  // - Portrait (aspectRatio < 0.85) -> Vertical Stack
  let layoutMode: LayoutMode;
  if (aspectRatio >= 3.0) {
    layoutMode = "cinema-wide-strip";
  } else if (aspectRatio >= 1.4) {
    layoutMode = "horizontal-split";
  } else if (aspectRatio >= 0.85) {
    layoutMode = "multi-column-grid";
  } else {
    layoutMode = "vertical-stack";
  }

  // =========================================================================
  // PASS 2: Hard Constraint Enforcement & Baseline Sizing
  // =========================================================================
  // Viewing distance typography multiplier:
  // "far" (billboard/TV overlay) requires ~2.0-2.4x scale for legibility at 10ft+
  // "medium" (kiosk) requires ~1.3x scale
  // "near" (phone/watch) uses 1.0x baseline
  let viewingDistanceMultiplier = 1.0;
  if (surface.viewingDistance === "far") {
    viewingDistanceMultiplier = 2.2;
  } else if (surface.viewingDistance === "medium") {
    viewingDistanceMultiplier = 1.35;
  }

  const surfaceMinText = (surface.minTextSize || 12) * (surface.viewingDistance === "far" ? 1.0 : 1.0);
  const minTapTargetRequired = surface.touchOnly ? (surface.minTapTarget ?? 44) : 36;

  // Initialize draft elements map
  type InternalElement = {
    spec: AdElementSpec;
    box: ResolvedElementBox;
    currentScale: number;
    content: string;
  };

  const draftElements = new Map<string, InternalElement>();

  for (const element of adSpec.elements) {
    const box: ResolvedElementBox = {
      id: element.id,
      type: element.type,
      role: element.role,
      priority: element.priority,
      visible: true,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      degradationLevel: 0,
    };

    let content = "";
    if (element.type === "text") {
      const textEl = element as TextElementSpec;
      content = textEl.content;
      const baseFont = (textEl.role === "primary" ? 22 : 15) * viewingDistanceMultiplier;
      const clampedFont = Math.max(surfaceMinText, Math.min(textEl.maxFontSize ?? 48, baseFont));
      box.fontSize = Math.round(clampedFont);
      box.lineHeight = Math.round(box.fontSize * 1.3);
    } else if (element.type === "button") {
      const btnEl = element as ButtonElementSpec;
      content = btnEl.label;
      const baseBtnFont = (btnEl.variant === "primary" ? 16 : 14) * viewingDistanceMultiplier;
      box.fontSize = Math.round(Math.max(surfaceMinText * 0.9, baseBtnFont));
      box.minTapTargetMet = true;
    }

    draftElements.set(element.id, {
      spec: element,
      box,
      currentScale: 1.0,
      content,
    });
  }

  // =========================================================================
  // PASS 3: Priority-Based Degradation & Budget Allocation Loop
  // =========================================================================
  // We compute spatial budgets based on the chosen topology. If the content
  // exceeds the safe dimensions, we deterministically degrade in priority order:
  // 1. Spacing compression (gaps shrink from 16px to 8px to 4px)
  // 2. Priority 3 elements (Branding/Logo) shrink, then drop entirely
  // 3. Priority 2 elements (Price/Secondary copy) compress font/truncate, then drop
  // 4. Hero image shrinks towards minWidth/minHeight
  // 5. Priority 1 (Headline & Hero) and critical CTA persist to the limit.

  let spacing = Math.max(6, Math.min(18, Math.round(safeH * 0.035)));
  let budgetSatisfied = false;
  let degradationIterations = 0;
  const maxDegradationIterations = 10;

  while (!budgetSatisfied && degradationIterations < maxDegradationIterations) {
    degradationIterations++;

    // Compute sizes for all currently visible elements under current parameters
    const visibleDrafts = Array.from(draftElements.values()).filter((e) => e.box.visible);

    if (layoutMode === "vertical-stack") {
      let totalContentHeight = 0;
      const availableContentWidth = safeW;

      for (const item of visibleDrafts) {
        if (item.spec.type === "image") {
          const imgSpec = item.spec as ImageElementSpec;
          // Allocate hero image height based on available viewport fraction
          const maxImgH = Math.round(safeH * (imgSpec.role === "hero" ? 0.38 : 0.12) * item.currentScale);
          const computedH = Math.max(imgSpec.minHeight || 40, maxImgH);
          const computedW = Math.min(availableContentWidth, Math.round(computedH * imgSpec.aspectRatio));
          item.box.width = computedW;
          item.box.height = computedH;
        } else if (item.spec.type === "text") {
          const textSpec = item.spec as TextElementSpec;
          const { width, height } = estimateTextDimensions(
            item.content,
            item.box.fontSize || 16,
            availableContentWidth,
            textSpec.maxLines || 2
          );
          item.box.width = width;
          item.box.height = height;
        } else if (item.spec.type === "button") {
          const btnH = Math.max(minTapTargetRequired, Math.round(44 * item.currentScale));
          const btnW = Math.min(availableContentWidth, Math.max(160, Math.round(safeW * 0.85)));
          item.box.width = btnW;
          item.box.height = btnH;
        }
        totalContentHeight += item.box.height;
      }

      totalContentHeight += Math.max(0, visibleDrafts.length - 1) * spacing;

      if (totalContentHeight <= safeH) {
        budgetSatisfied = true;
        break;
      }

      // Not enough space: apply degradation step
      const overflow = totalContentHeight - safeH;

      // Stage 1: Compress spacing
      if (spacing > 6) {
        spacing = Math.max(4, spacing - 4);
        degradationLog.push(`Compressed inter-element spacing to ${spacing}px (overflow was ${overflow}px)`);
        continue;
      }

      // Stage 2: Degrade Priority 3 (Logo/Branding)
      const p3Item = visibleDrafts.find((e) => e.spec.priority === 3);
      if (p3Item) {
        if (p3Item.currentScale > 0.65) {
          p3Item.currentScale = 0.6;
          p3Item.box.shrunk = true;
          p3Item.box.degradationLevel = 1;
          degradationLog.push(`Shrank Priority 3 element '${p3Item.spec.id}' to 60% scale`);
          continue;
        } else {
          p3Item.box.visible = false;
          p3Item.box.degradationLevel = 3;
          p3Item.box.dropReason = `Dropped Priority 3 '${p3Item.spec.id}' to guarantee headline/hero integrity`;
          degradationLog.push(p3Item.box.dropReason);
          continue;
        }
      }

      // Stage 3: Degrade Priority 2 secondary text (e.g. price)
      const p2Text = visibleDrafts.find((e) => e.spec.priority === 2 && e.spec.type === "text");
      if (p2Text && !p2Text.box.truncated) {
        // Truncate price to compact form
        p2Text.content = p2Text.content.split("•")[0]?.trim() || p2Text.content.substring(0, 12);
        p2Text.box.truncated = true;
        p2Text.box.fontSize = Math.max(surfaceMinText, Math.round((p2Text.box.fontSize || 14) * 0.85));
        p2Text.box.degradationLevel = 2;
        degradationLog.push(`Truncated and condensed Priority 2 secondary text '${p2Text.spec.id}'`);
        continue;
      } else if (p2Text && p2Text.box.visible && overflow > 30) {
        p2Text.box.visible = false;
        p2Text.box.degradationLevel = 3;
        p2Text.box.dropReason = `Dropped Priority 2 text '${p2Text.spec.id}' under strict height deficit`;
        degradationLog.push(p2Text.box.dropReason);
        continue;
      }

      // Stage 4: Shrink hero image towards minHeight
      const hero = visibleDrafts.find((e) => e.spec.role === "hero");
      if (hero && hero.currentScale > 0.6) {
        hero.currentScale = Math.max(0.55, hero.currentScale - 0.2);
        hero.box.shrunk = true;
        hero.box.degradationLevel = 1;
        degradationLog.push(`Scaled down hero image '${hero.spec.id}' to ${(hero.currentScale * 100).toFixed(0)}%`);
        continue;
      }

      // Stage 5: Shrink headline font size towards surfaceMinText
      const headline = visibleDrafts.find((e) => e.spec.role === "primary" && e.spec.type === "text");
      if (headline && (headline.box.fontSize || 16) > surfaceMinText) {
        headline.box.fontSize = Math.max(surfaceMinText, Math.round((headline.box.fontSize || 16) * 0.85));
        headline.box.lineHeight = Math.round((headline.box.fontSize || 16) * 1.25);
        headline.box.shrunk = true;
        degradationLog.push(`Decreased headline font size to ${headline.box.fontSize}px`);
        continue;
      }

      // If we reach here, we've degraded as much as possible
      budgetSatisfied = true;
    } else if (layoutMode === "cinema-wide-strip") {
      // Ultra-wide banner: horizontal flow
      let totalWidth = 0;
      const maxHeight = safeH;

      for (const item of visibleDrafts) {
        if (item.spec.type === "image") {
          const imgSpec = item.spec as ImageElementSpec;
          const targetH = Math.round(maxHeight * (imgSpec.role === "hero" ? 0.9 : 0.55) * item.currentScale);
          const computedH = Math.max(imgSpec.minHeight || 30, targetH);
          const computedW = Math.round(computedH * imgSpec.aspectRatio);
          item.box.width = computedW;
          item.box.height = computedH;
        } else if (item.spec.type === "text") {
          const textSpec = item.spec as TextElementSpec;
          const font = item.box.fontSize || 24;
          const { width, height } = estimateTextDimensions(
            item.content,
            font,
            Math.round(safeW * 0.38),
            textSpec.maxLines || 1
          );
          item.box.width = width;
          item.box.height = Math.min(maxHeight, height);
        } else if (item.spec.type === "button") {
          const btnH = Math.max(minTapTargetRequired, Math.round(maxHeight * 0.5));
          item.box.height = btnH;
          item.box.width = Math.round(Math.max(140, btnH * 3.2));
        }
        totalWidth += item.box.width;
      }

      totalWidth += Math.max(0, visibleDrafts.length - 1) * spacing;

      if (totalWidth <= safeW) {
        budgetSatisfied = true;
        break;
      }

      const overflow = totalWidth - safeW;

      // Degrade Priority 3 (Logo)
      const p3 = visibleDrafts.find((e) => e.spec.priority === 3);
      if (p3) {
        p3.box.visible = false;
        p3.box.degradationLevel = 3;
        p3.box.dropReason = `Dropped '${p3.spec.id}' in wide strip to fit within ${safeW}px width`;
        degradationLog.push(p3.box.dropReason);
        continue;
      }

      // Truncate headline/price
      const p2Text = visibleDrafts.find((e) => e.spec.priority === 2 && e.spec.type === "text");
      if (p2Text && !p2Text.box.truncated) {
        p2Text.content = p2Text.content.split("•")[0]?.trim() || p2Text.content.substring(0, 10);
        p2Text.box.truncated = true;
        degradationLog.push(`Truncated '${p2Text.spec.id}' text to save horizontal span`);
        continue;
      } else if (p2Text && overflow > 100) {
        p2Text.box.visible = false;
        p2Text.box.degradationLevel = 3;
        p2Text.box.dropReason = `Dropped Priority 2 price under width constraint`;
        degradationLog.push(p2Text.box.dropReason);
        continue;
      }

      budgetSatisfied = true;
    } else if (layoutMode === "horizontal-split") {
      // Split layout: 45% media column, 55% copy column
      const colWidth = Math.round((safeW - spacing) * 0.48);

      for (const item of visibleDrafts) {
        if (item.spec.type === "image" && item.spec.role === "hero") {
          const imgSpec = item.spec as ImageElementSpec;
          const targetW = colWidth;
          const targetH = Math.min(safeH, Math.round(targetW / imgSpec.aspectRatio));
          item.box.width = targetW;
          item.box.height = targetH;
        } else if (item.spec.type === "image") {
          // Branding logo
          const imgSpec = item.spec as ImageElementSpec;
          const targetH = Math.min(36, Math.round(safeH * 0.12));
          item.box.height = targetH;
          item.box.width = Math.round(targetH * imgSpec.aspectRatio);
        } else if (item.spec.type === "text") {
          const textSpec = item.spec as TextElementSpec;
          const { width, height } = estimateTextDimensions(
            item.content,
            item.box.fontSize || 16,
            colWidth,
            textSpec.maxLines || 2
          );
          item.box.width = width;
          item.box.height = height;
        } else if (item.spec.type === "button") {
          item.box.height = Math.max(minTapTargetRequired, 42);
          item.box.width = Math.min(colWidth, Math.max(160, Math.round(colWidth * 0.9)));
        }
      }

      // Check vertical overflow in right column (logo + headline + price + cta)
      const rightColItems = visibleDrafts.filter((e) => e.spec.role !== "hero");
      const rightColH = rightColItems.reduce((acc, cur) => acc + cur.box.height, 0) + (rightColItems.length - 1) * spacing;

      if (rightColH <= safeH) {
        budgetSatisfied = true;
        break;
      }

      const p3 = visibleDrafts.find((e) => e.spec.priority === 3);
      if (p3) {
        p3.box.visible = false;
        p3.box.degradationLevel = 3;
        p3.box.dropReason = `Dropped Priority 3 logo in horizontal split to prevent column overflow`;
        degradationLog.push(p3.box.dropReason);
        continue;
      }

      const p2 = visibleDrafts.find((e) => e.spec.priority === 2 && e.spec.type === "text");
      if (p2 && !p2.box.truncated) {
        p2.box.truncated = true;
        p2.content = p2.content.split("•")[0]?.trim() || p2.content.substring(0, 10);
        continue;
      }

      budgetSatisfied = true;
    } else {
      // multi-column-grid (e.g. Retail Kiosk 1:1)
      const quadrantW = Math.round((safeW - spacing) * 0.5);

      for (const item of visibleDrafts) {
        if (item.spec.role === "hero") {
          const imgSpec = item.spec as ImageElementSpec;
          const h = Math.min(safeH * 0.5, Math.round(safeW * 0.45));
          item.box.height = h;
          item.box.width = Math.round(h * imgSpec.aspectRatio);
        } else if (item.spec.type === "image") {
          item.box.height = Math.round(safeH * 0.08);
          item.box.width = Math.round(item.box.height * (item.spec as ImageElementSpec).aspectRatio);
        } else if (item.spec.type === "text") {
          const textSpec = item.spec as TextElementSpec;
          const { width, height } = estimateTextDimensions(
            item.content,
            item.box.fontSize || 20,
            safeW,
            textSpec.maxLines || 2
          );
          item.box.width = width;
          item.box.height = height;
        } else if (item.spec.type === "button") {
          item.box.height = Math.max(minTapTargetRequired, 56);
          item.box.width = Math.min(safeW * 0.6, 360);
        }
      }

      // Check vertical height of stacked sections
      const totalGridH = visibleDrafts.reduce((acc, cur) => acc + cur.box.height, 0) + (visibleDrafts.length - 1) * spacing;
      if (totalGridH <= safeH) {
        budgetSatisfied = true;
        break;
      }

      // Degrade Priority 3 first
      const p3 = visibleDrafts.find((e) => e.spec.priority === 3);
      if (p3) {
        p3.box.visible = false;
        p3.box.degradationLevel = 3;
        p3.box.dropReason = `Dropped Priority 3 in grid layout to preserve accessible touch targets`;
        degradationLog.push(p3.box.dropReason);
        continue;
      }

      budgetSatisfied = true;
    }
  }

  // =========================================================================
  // PASS 4: Box Packing & Pixel Placement Coordinates
  // =========================================================================
  const resolvedElements: Record<string, ResolvedElementBox> = {};
  const visibleItems = Array.from(draftElements.values()).filter((e) => e.box.visible);

  if (layoutMode === "vertical-stack") {
    // Center items vertically or distribute cleanly
    const totalVisibleH = visibleItems.reduce((acc, cur) => acc + cur.box.height, 0) + (visibleItems.length - 1) * spacing;
    let currentY = safeY + Math.max(0, Math.round((safeH - totalVisibleH) / 2));

    // Sort order for vertical stack:
    // 1. Branding logo (if present)
    // 2. Headline
    // 3. Hero image
    // 4. Price
    // 5. CTA button (placed near bottom for mobile thumb accessibility)
    const orderScore = (item: InternalElement) => {
      if (item.spec.role === "branding") return 1;
      if (item.spec.role === "primary") return 2;
      if (item.spec.role === "hero") return 3;
      if (item.spec.role === "secondary") return 4;
      if (item.spec.role === "action") return 5;
      return 6;
    };

    visibleItems.sort((a, b) => orderScore(a) - orderScore(b));

    for (const item of visibleItems) {
      item.box.x = safeX + Math.max(0, Math.round((safeW - item.box.width) / 2));
      item.box.y = currentY;
      currentY += item.box.height + spacing;
    }
  } else if (layoutMode === "cinema-wide-strip") {
    // Ultra-wide banner: left-to-right horizontal alignment with vertical centering
    // Sequence: [Branding Logo] -> [Headline + Price] -> [Hero Image] -> [CTA Button]
    const totalVisibleW = visibleItems.reduce((acc, cur) => acc + cur.box.width, 0) + (visibleItems.length - 1) * spacing;
    let currentX = safeX + Math.max(0, Math.round((safeW - totalVisibleW) / 2));

    const wideOrder = (item: InternalElement) => {
      if (item.spec.role === "branding") return 1;
      if (item.spec.role === "primary") return 2;
      if (item.spec.role === "secondary") return 3;
      if (item.spec.role === "hero") return 4;
      if (item.spec.role === "action") return 5;
      return 6;
    };

    visibleItems.sort((a, b) => wideOrder(a) - wideOrder(b));

    for (const item of visibleItems) {
      item.box.x = currentX;
      item.box.y = safeY + Math.max(0, Math.round((safeH - item.box.height) / 2));
      currentX += item.box.width + spacing;
    }
  } else if (layoutMode === "horizontal-split") {
    // Two columns: Left = Hero image, Right = Logo, Headline, Price, CTA
    const heroItem = visibleItems.find((e) => e.spec.role === "hero");
    const copyItems = visibleItems.filter((e) => e.spec.role !== "hero");

    const leftColW = heroItem ? heroItem.box.width : 0;
    const rightColX = safeX + leftColW + spacing;
    const rightColW = safeW - leftColW - spacing;

    if (heroItem) {
      heroItem.box.x = safeX;
      heroItem.box.y = safeY + Math.max(0, Math.round((safeH - heroItem.box.height) / 2));
    }

    const totalCopyH = copyItems.reduce((acc, cur) => acc + cur.box.height, 0) + (copyItems.length - 1) * spacing;
    let rightY = safeY + Math.max(0, Math.round((safeH - totalCopyH) / 2));

    const copyOrder = (item: InternalElement) => {
      if (item.spec.role === "branding") return 1;
      if (item.spec.role === "primary") return 2;
      if (item.spec.role === "secondary") return 3;
      if (item.spec.role === "action") return 4;
      return 5;
    };

    copyItems.sort((a, b) => copyOrder(a) - copyOrder(b));

    for (const item of copyItems) {
      item.box.x = rightColX;
      item.box.y = rightY;
      rightY += item.box.height + spacing;
    }
  } else {
    // multi-column-grid (Retail Kiosk / Balanced):
    // Hero centered at upper half; Headline, Price, CTA cleanly anchored below
    const heroItem = visibleItems.find((e) => e.spec.role === "hero");
    const otherItems = visibleItems.filter((e) => e.spec.role !== "hero");

    const totalH = (heroItem ? heroItem.box.height + spacing : 0) +
      otherItems.reduce((acc, cur) => acc + cur.box.height, 0) + (otherItems.length - 1) * spacing;

    let curY = safeY + Math.max(0, Math.round((safeH - totalH) / 2));

    if (heroItem) {
      heroItem.box.x = safeX + Math.max(0, Math.round((safeW - heroItem.box.width) / 2));
      heroItem.box.y = curY;
      curY += heroItem.box.height + spacing;
    }

    for (const item of otherItems) {
      item.box.x = safeX + Math.max(0, Math.round((safeW - item.box.width) / 2));
      item.box.y = curY;
      curY += item.box.height + spacing;
    }
  }

  // Populate resolved elements dictionary
  const elementList: ResolvedElementBox[] = [];
  const degradedElementIds: string[] = [];
  const droppedElementIds: string[] = [];

  let totalAreaUsed = 0;

  draftElements.forEach((item, id) => {
    resolvedElements[id] = item.box;
    elementList.push(item.box);

    if (item.box.degradationLevel > 0) {
      degradedElementIds.push(id);
    }
    if (!item.box.visible) {
      droppedElementIds.push(id);
    } else {
      totalAreaUsed += item.box.width * item.box.height;
    }
  });

  // Verify non-collision
  let hasCollisions = false;
  for (let i = 0; i < visibleItems.length; i++) {
    for (let j = i + 1; j < visibleItems.length; j++) {
      if (doBoxesCollide(visibleItems[i].box, visibleItems[j].box, 0.5)) {
        hasCollisions = true;
        degradationLog.push(`Collision detected between ${visibleItems[i].spec.id} and ${visibleItems[j].spec.id}`);
      }
    }
  }

  const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;
  const packingEfficiency = Math.min(100, Math.round((totalAreaUsed / (safeW * safeH)) * 100));

  return {
    adId: adSpec.id,
    surfaceId: surface.id,
    surfaceWidth: surface.width,
    surfaceHeight: surface.height,
    safeBounds,
    layoutMode,
    elements: resolvedElements,
    elementList,
    degradedElementIds,
    droppedElementIds,
    diagnostics: {
      pass1Orientation: layoutMode,
      aspectRatio: Math.round(aspectRatio * 100) / 100,
      safeAreaBounds: safeBounds,
      viewingDistanceScale: viewingDistanceMultiplier,
      appliedConstraints: {
        minTapTarget: minTapTargetRequired,
        minTextSize: surfaceMinText,
        touchOptimized: surface.touchOnly ?? false,
      },
      pass3DegradationSteps: degradationLog,
      packingEfficiency,
      hasCollisions,
      resolutionTimeMs: Math.max(0.1, executionTimeMs),
    },
  };
}
