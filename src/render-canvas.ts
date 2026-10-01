/**
 * Canvas 2D Renderer
 * 
 * Demonstrates clean architectural separation: The Canvas renderer consumes the exact
 * same ResolvedLayout and AdSpec as render-dom.ts without touching a single line
 * of the constraint resolution engine.
 */

import { ResolvedLayout, ResolvedElementBox } from "./resolver";
import { AdSpec, TextElementSpec, ImageElementSpec, ButtonElementSpec } from "./spec";

export interface CanvasRenderOptions {
  showSafeAreas?: boolean;
  showBoundingBoxes?: boolean;
  highlightDegraded?: boolean;
}

/**
 * Cache for loaded HTML images
 */
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      // Return placeholder image
      resolve(img);
    };
    img.src = src;
  });
}

/**
 * Renders a ResolvedLayout onto an HTML5 Canvas context.
 */
export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  layout: ResolvedLayout,
  spec: AdSpec,
  options: CanvasRenderOptions = {}
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  canvas.width = layout.surfaceWidth * dpr;
  canvas.height = layout.surfaceHeight * dpr;
  canvas.style.width = `${layout.surfaceWidth}px`;
  canvas.style.height = `${layout.surfaceHeight}px`;

  ctx.scale(dpr, dpr);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, layout.surfaceWidth, layout.surfaceHeight);
  bgGrad.addColorStop(0, "#090d16");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, layout.surfaceWidth, layout.surfaceHeight);

  // Safe area overlay
  if (options.showSafeAreas) {
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      layout.safeBounds.x,
      layout.safeBounds.y,
      layout.safeBounds.width,
      layout.safeBounds.height
    );
    ctx.fillStyle = "rgba(99, 102, 241, 0.7)";
    ctx.font = "10px monospace";
    ctx.fillText(
      `SAFE AREA ${layout.safeBounds.width}x${layout.safeBounds.height}`,
      layout.safeBounds.x + 8,
      layout.safeBounds.y + 16
    );
    ctx.restore();
  }

  // Render elements in order
  for (const box of layout.elementList) {
    if (!box.visible) continue;

    const elSpec = spec.elements.find((e) => e.id === box.id);
    if (!elSpec) continue;

    // Optional debug bounding box
    if (options.showBoundingBoxes) {
      ctx.strokeStyle = "rgba(236, 72, 153, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }

    if (box.type === "image") {
      const imgSpec = elSpec as ImageElementSpec;
      try {
        const img = await loadImage(imgSpec.src);
        if (img.complete && img.naturalWidth > 0) {
          ctx.save();
          // Draw subtle drop shadow
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 16;
          ctx.shadowOffsetY = 6;
          ctx.drawImage(img, box.x, box.y, box.width, box.height);
          ctx.restore();
        } else {
          // Fallback colored placeholder
          ctx.fillStyle = "#312e81";
          ctx.fillRect(box.x, box.y, box.width, box.height);
          ctx.fillStyle = "#a5b4fc";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(imgSpec.alt, box.x + box.width / 2, box.y + box.height / 2);
        }
      } catch (e) {
        // Ignored
      }
    } else if (box.type === "text") {
      const textSpec = elSpec as TextElementSpec;
      ctx.save();
      const fontSize = box.fontSize || 16;
      const fontWeight = textSpec.weight === "black" ? "900" : textSpec.weight === "bold" ? "700" : "500";
      ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
      ctx.fillStyle = textSpec.role === "primary" ? "#ffffff" : "#c7d2fe";
      ctx.textAlign = layout.layoutMode === "horizontal-split" ? "left" : "center";
      ctx.textBaseline = "middle";

      const textToDraw = box.truncated
        ? textSpec.content.split("•")[0]?.trim() || textSpec.content
        : textSpec.content;

      const drawX = layout.layoutMode === "horizontal-split" ? box.x : box.x + box.width / 2;
      const drawY = box.y + box.height / 2;

      ctx.fillText(textToDraw, drawX, drawY);
      ctx.restore();
    } else if (box.type === "button") {
      const btnSpec = elSpec as ButtonElementSpec;
      ctx.save();
      const radius = 10;
      const btnGrad = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
      btnGrad.addColorStop(0, "#6366f1");
      btnGrad.addColorStop(1, "#ec4899");

      // Draw rounded rectangle
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.width, box.height, radius);
      ctx.fill();

      // Button label
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${box.fontSize || 15}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btnSpec.label, box.x + box.width / 2, box.y + box.height / 2);
      ctx.restore();
    }
  }
}
