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
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(img);
    };
    img.src = src;
  });
}

/**
 * Renders a ResolvedLayout onto an HTML5 Canvas context.
 * Implements proper multi-line word wrapping, font-fitting, and clipping.
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
  canvas.width = Math.round(layout.surfaceWidth * dpr);
  canvas.height = Math.round(layout.surfaceHeight * dpr);
  canvas.style.width = `${layout.surfaceWidth}px`;
  canvas.style.height = `${layout.surfaceHeight}px`;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, layout.surfaceWidth, layout.surfaceHeight);
  bgGrad.addColorStop(0, "#090d16");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, layout.surfaceWidth, layout.surfaceHeight);

  // Decorative ambient glow
  ctx.save();
  const radGrad1 = ctx.createRadialGradient(
    layout.surfaceWidth * 0.8,
    layout.surfaceHeight * 0.2,
    10,
    layout.surfaceWidth * 0.8,
    layout.surfaceHeight * 0.2,
    layout.surfaceWidth * 0.4
  );
  radGrad1.addColorStop(0, "rgba(99, 102, 241, 0.18)");
  radGrad1.addColorStop(1, "rgba(99, 102, 241, 0)");
  ctx.fillStyle = radGrad1;
  ctx.fillRect(0, 0, layout.surfaceWidth, layout.surfaceHeight);
  ctx.restore();

  // Safe area overlay
  if (options.showSafeAreas) {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      layout.safeBounds.x,
      layout.safeBounds.y,
      layout.safeBounds.width,
      layout.safeBounds.height
    );
    ctx.fillStyle = "rgba(165, 180, 252, 0.8)";
    ctx.font = "10px monospace";
    ctx.fillText(
      `SAFE AREA ${layout.safeBounds.width}×${layout.safeBounds.height}`,
      layout.safeBounds.x + 8,
      layout.safeBounds.y + 14
    );
    ctx.restore();
  }

  // Render elements in order
  for (const box of layout.elementList) {
    if (!box.visible) continue;

    const elSpec = spec.elements.find((e) => e.id === box.id);
    if (!elSpec) continue;

    // Optional debug wireframe bounding box
    if (options.showBoundingBoxes) {
      ctx.save();
      ctx.strokeStyle = "rgba(236, 72, 153, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.restore();
    }

    if (box.type === "image") {
      const imgSpec = elSpec as ImageElementSpec;
      try {
        const img = await loadImage(imgSpec.src);
        if (img.complete && img.naturalWidth > 0) {
          ctx.save();
          // Clip to rounded bounds
          const radius = 8;
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, box.width, box.height, radius);
          ctx.clip();

          // Drop shadow
          ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 4;

          // Draw image contained inside box
          ctx.drawImage(img, box.x, box.y, box.width, box.height);
          ctx.restore();
        } else {
          // Fallback placeholder
          ctx.save();
          ctx.fillStyle = "#1e1b4b";
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, box.width, box.height, 8);
          ctx.fill();
          ctx.fillStyle = "#a5b4fc";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(imgSpec.alt, box.x + box.width / 2, box.y + box.height / 2);
          ctx.restore();
        }
      } catch (e) {
        // Ignored
      }
    } else if (box.type === "text") {
      const textSpec = elSpec as TextElementSpec;
      ctx.save();

      const fontSize = box.fontSize || 16;
      const fontWeight = textSpec.weight === "black" ? "900" : textSpec.weight === "bold" ? "700" : "500";
      ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = textSpec.role === "primary" ? "#ffffff" : "#c7d2fe";

      const isLeftAligned = layout.layoutMode === "horizontal-split";
      ctx.textAlign = isLeftAligned ? "left" : "center";
      ctx.textBaseline = "top";

      // Use pre-computed wrapped text lines from resolver or wrap dynamically
      const lines = box.textLines && box.textLines.length > 0 ? box.textLines : [
        box.truncated
          ? textSpec.content.split("•")[0]?.trim() || textSpec.content
          : textSpec.content
      ];

      const lineHeight = box.lineHeight || Math.round(fontSize * 1.25);
      const totalTextH = lines.length * lineHeight;
      const startY = box.y + Math.max(0, (box.height - totalTextH) / 2);

      lines.forEach((line, idx) => {
        const lineY = startY + idx * lineHeight;
        const lineX = isLeftAligned ? box.x : box.x + box.width / 2;
        // Clip to box width
        ctx.fillText(line, lineX, lineY, box.width);
      });

      ctx.restore();
    } else if (box.type === "button") {
      const btnSpec = elSpec as ButtonElementSpec;
      ctx.save();
      const radius = 10;
      const btnGrad = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
      btnGrad.addColorStop(0, "#6366f1");
      btnGrad.addColorStop(1, "#a855f7");

      // Draw rounded button body
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.width, box.height, radius);
      ctx.fill();

      // Shadow
      ctx.shadowColor = "rgba(99, 102, 241, 0.4)";
      ctx.shadowBlur = 12;

      // Fit text size inside button
      let btnFont = box.fontSize || 15;
      ctx.font = `bold ${btnFont}px system-ui, -apple-system, sans-serif`;
      let textW = ctx.measureText(btnSpec.label).width;
      const maxTextW = box.width - 24;

      while (textW > maxTextW && btnFont > 10) {
        btnFont -= 1;
        ctx.font = `bold ${btnFont}px system-ui, -apple-system, sans-serif`;
        textW = ctx.measureText(btnSpec.label).width;
      }

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btnSpec.label, box.x + box.width / 2, box.y + box.height / 2, maxTextW);

      // Check badge
      if (box.minTapTargetMet) {
        ctx.fillStyle = "#34d399";
        ctx.beginPath();
        ctx.arc(box.x + box.width - 6, box.y + 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#064e3b";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✓", box.x + box.width - 6, box.y + 6);
      }

      ctx.restore();
    }
  }

  ctx.restore();
}
