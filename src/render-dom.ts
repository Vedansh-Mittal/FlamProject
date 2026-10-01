/**
 * DOM & React Renderer (Pure TypeScript without JSX syntax)
 * 
 * Converts a ResolvedLayout and AdSpec into high-fidelity DOM elements or React virtual DOM.
 * Uses explicit pixel coordinates (x, y, width, height) computed by resolver.ts,
 * applying GPU-accelerated absolute positioning and smooth transitions.
 */

import React from "react";
import { ResolvedLayout, ResolvedElementBox } from "./resolver";
import { AdSpec, TextElementSpec, ImageElementSpec, ButtonElementSpec } from "./spec";

export interface RenderOptions {
  showSafeAreas?: boolean;
  showBoundingBoxes?: boolean;
  interactive?: boolean;
  scale?: number;
  highlightDegraded?: boolean;
  onElementClick?: (elementId: string) => void;
}

/**
 * Pure DOM Element Tree Generator (Framework-Agnostic)
 */
export function createDomAd(
  layout: ResolvedLayout,
  spec: AdSpec,
  options: RenderOptions = {}
): HTMLElement {
  const container = document.createElement("div");
  container.className = "ad-surface-container";
  container.style.position = "relative";
  container.style.width = `${layout.surfaceWidth}px`;
  container.style.height = `${layout.surfaceHeight}px`;
  container.style.overflow = "hidden";
  container.style.backgroundColor = "#090d16";
  container.style.backgroundImage = "radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.15), transparent 70%)";
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "system-ui, -apple-system, sans-serif";
  container.style.color = "#ffffff";
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", spec.metadata?.title || "Adaptive Advertisement");

  // Optional Safe Area Indicator
  if (options.showSafeAreas) {
    const safeBox = document.createElement("div");
    safeBox.className = "ad-safe-area-overlay";
    safeBox.style.position = "absolute";
    safeBox.style.left = `${layout.safeBounds.x}px`;
    safeBox.style.top = `${layout.safeBounds.y}px`;
    safeBox.style.width = `${layout.safeBounds.width}px`;
    safeBox.style.height = `${layout.safeBounds.height}px`;
    safeBox.style.border = "1.5px dashed rgba(99, 102, 241, 0.5)";
    safeBox.style.pointerEvents = "none";
    safeBox.style.zIndex = "99";
    container.appendChild(safeBox);
  }

  // Render Resolved Elements
  for (const box of layout.elementList) {
    if (!box.visible) continue;

    const elSpec = spec.elements.find((e) => e.id === box.id);
    if (!elSpec) continue;

    const elNode = document.createElement("div");
    elNode.className = `ad-element ad-element-${box.id}`;
    elNode.style.position = "absolute";
    elNode.style.left = `${box.x}px`;
    elNode.style.top = `${box.y}px`;
    elNode.style.width = `${box.width}px`;
    elNode.style.height = `${box.height}px`;
    elNode.style.boxSizing = "border-box";
    elNode.style.transition = "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)";
    elNode.style.display = "flex";
    elNode.style.alignItems = "center";
    elNode.style.justifyContent = layout.layoutMode === "horizontal-split" && box.type === "text" ? "flex-start" : "center";

    if (options.showBoundingBoxes) {
      elNode.style.outline = "1px solid rgba(236, 72, 153, 0.6)";
      elNode.style.backgroundColor = "rgba(236, 72, 153, 0.05)";
    }

    if (box.type === "image") {
      const imgSpec = elSpec as ImageElementSpec;
      const img = document.createElement("img");
      img.src = imgSpec.src;
      img.alt = imgSpec.alt;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = imgSpec.objectFit || "contain";
      img.style.borderRadius = "8px";
      img.style.filter = "drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4))";
      elNode.appendChild(img);
    } else if (box.type === "text") {
      const textSpec = elSpec as TextElementSpec;
      const p = document.createElement("div");
      const lines = box.textLines && box.textLines.length > 0 ? box.textLines : [textSpec.content];
      p.innerHTML = lines.join("<br/>");
      p.style.fontSize = `${box.fontSize}px`;
      p.style.lineHeight = `${box.lineHeight || Math.round((box.fontSize || 16) * 1.25)}px`;
      p.style.fontWeight = textSpec.weight === "black" ? "900" : textSpec.weight === "bold" ? "700" : "500";
      p.style.color = textSpec.role === "primary" ? "#ffffff" : "#94a3b8";
      p.style.textAlign = layout.layoutMode === "horizontal-split" ? "left" : "center";
      p.style.overflow = "hidden";
      p.style.width = "100%";
      elNode.appendChild(p);
    } else if (box.type === "button") {
      const btnSpec = elSpec as ButtonElementSpec;
      const btn = document.createElement("button");
      btn.innerText = btnSpec.label;
      btn.style.width = "100%";
      btn.style.height = "100%";
      btn.style.fontSize = `${box.fontSize}px`;
      btn.style.fontWeight = "700";
      btn.style.borderRadius = "10px";
      btn.style.border = "none";
      btn.style.background = "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)";
      btn.style.color = "#ffffff";
      btn.style.cursor = "pointer";
      btn.style.boxShadow = "0 4px 14px rgba(99, 102, 241, 0.4)";
      btn.style.transition = "transform 0.15s ease, box-shadow 0.15s ease";
      elNode.appendChild(btn);
    }

    container.appendChild(elNode);
  }

  return container;
}

/**
 * React Component for Rendering Resolved Ad Layouts
 * Constructed cleanly with React.createElement to keep src/render-dom.ts pure TypeScript.
 */
export const AdDomRenderer: React.FC<{
  layout: ResolvedLayout;
  spec: AdSpec;
  options?: RenderOptions;
  scale?: number;
}> = ({ layout, spec, options = {}, scale = 1 }) => {
  const { showSafeAreas = false, showBoundingBoxes = false, highlightDegraded = false } = options;

  const children: React.ReactNode[] = [];

  // Background subtle glow circles
  children.push(
    React.createElement("div", {
      key: "glow-1",
      className: "pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl",
      "aria-hidden": "true",
    }),
    React.createElement("div", {
      key: "glow-2",
      className: "pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl",
      "aria-hidden": "true",
    })
  );

  // Safe area overlay box
  if (showSafeAreas) {
    children.push(
      React.createElement(
        "div",
        {
          key: "safe-area-guide",
          style: {
            position: "absolute",
            left: layout.safeBounds.x,
            top: layout.safeBounds.y,
            width: layout.safeBounds.width,
            height: layout.safeBounds.height,
          },
          className:
            "pointer-events-none z-50 rounded border-2 border-dashed border-indigo-400/40 bg-indigo-500/5 transition-all duration-300",
        },
        React.createElement(
          "div",
          {
            className: "absolute top-1 left-2 font-mono text-[9px] uppercase tracking-wider text-indigo-300/70",
          },
          `Safe Area (${layout.safeBounds.width}×${layout.safeBounds.height})`
        )
      )
    );
  }

  // Resolved elements
  for (const box of layout.elementList) {
    if (!box.visible) continue;

    const elSpec = spec.elements.find((e) => e.id === box.id);
    if (!elSpec) continue;

    const isDegraded = box.degradationLevel > 0;
    const elementChildren: React.ReactNode[] = [];

    if (box.type === "image") {
      const imgSpec = elSpec as ImageElementSpec;
      elementChildren.push(
        React.createElement("img", {
          key: "img",
          src: imgSpec.src,
          alt: imgSpec.alt,
          style: {
            maxHeight: "100%",
            maxWidth: "100%",
            objectFit: imgSpec.objectFit || "contain",
            filter:
              box.role === "hero"
                ? "drop-shadow(0 12px 28px rgba(0, 0, 0, 0.65))"
                : "drop-shadow(0 4px 10px rgba(0,0,0,0.4))",
          },
          className: "rounded-lg transition-transform duration-300 hover:scale-[1.02]",
        })
      );

      if (box.shrunk) {
        elementChildren.push(
          React.createElement(
            "span",
            {
              key: "badge-shrunk",
              className:
                "absolute top-0 right-0 rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-bold text-black uppercase tracking-tight shadow",
            },
            "Shrunk"
          )
        );
      }
    } else if (box.type === "text") {
      const textSpec = elSpec as TextElementSpec;
      const lines = box.textLines && box.textLines.length > 0 ? box.textLines : [
        box.truncated
          ? textSpec.content.split("•")[0]?.trim() || textSpec.content
          : textSpec.content
      ];

      const lineNodes = lines.map((line, lIdx) =>
        React.createElement(
          "p",
          {
            key: `line-${lIdx}`,
            style: {
              fontSize: `${box.fontSize}px`,
              lineHeight: `${box.lineHeight || Math.round((box.fontSize || 16) * 1.25)}px`,
              fontWeight:
                textSpec.weight === "black" ? 900 : textSpec.weight === "bold" ? 700 : 500,
            },
            className: `leading-tight transition-all duration-300 ${
              box.role === "primary"
                ? "text-white font-extrabold tracking-tight drop-shadow-sm"
                : "text-indigo-200/90 font-medium"
            }`,
          },
          line
        )
      );

      elementChildren.push(
        React.createElement(
          "div",
          {
            key: "text-wrapper",
            className: `w-full overflow-hidden ${
              layout.layoutMode === "horizontal-split" ? "text-left" : "text-center"
            }`,
          },
          lineNodes,
          box.truncated
            ? React.createElement(
                "span",
                {
                  key: "badge-condensed",
                  className: "inline-block mt-0.5 rounded bg-amber-500/80 px-1 text-[8px] font-semibold text-slate-950 uppercase",
                },
                "Condensed"
              )
            : null
        )
      );
    } else if (box.type === "button") {
      const btnSpec = elSpec as ButtonElementSpec;
      const btnInner: React.ReactNode[] = [
        React.createElement("span", { key: "label", className: "truncate drop-shadow" }, btnSpec.label),
      ];

      if (box.minTapTargetMet) {
        btnInner.push(
          React.createElement(
            "span",
            {
              key: "tap-check",
              title: `Meets ${box.height}px minimum tap target`,
              className:
                "absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-[8px] font-mono text-emerald-950 font-black shadow",
            },
            "✓"
          )
        );
      }

      elementChildren.push(
        React.createElement(
          "button",
          {
            key: "btn",
            type: "button",
            style: {
              width: "100%",
              height: "100%",
              fontSize: `${box.fontSize}px`,
            },
            className:
              "relative group flex items-center justify-center font-bold text-white rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer px-4",
            onClick: () => options.onElementClick?.(box.id),
          },
          btnInner
        )
      );
    }

    const alignmentClass =
      layout.layoutMode === "horizontal-split" && box.type === "text"
        ? "justify-start text-left"
        : "justify-center text-center";

    const boxClasses = [
      "flex items-center",
      alignmentClass,
      showBoundingBoxes ? "outline outline-1 outline-pink-500/60 bg-pink-500/10" : "",
      highlightDegraded && isDegraded ? "ring-2 ring-amber-400/80 ring-offset-1 ring-offset-slate-950" : "",
    ]
      .filter(Boolean)
      .join(" ");

    children.push(
      React.createElement(
        "div",
        {
          key: box.id,
          style: {
            position: "absolute",
            left: `${box.x}px`,
            top: `${box.y}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
            zIndex: box.type === "button" ? 20 : 10,
          },
          className: boxClasses,
        },
        elementChildren
      )
    );
  }

  const innerCanvas = React.createElement(
    "div",
    {
      style: {
        width: layout.surfaceWidth,
        height: layout.surfaceHeight,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        position: "absolute",
        top: 0,
        left: 0,
      },
    },
    children
  );

  return React.createElement(
    "div",
    {
      style: {
        width: Math.round(layout.surfaceWidth * scale),
        height: Math.round(layout.surfaceHeight * scale),
        position: "relative",
        transformOrigin: "top left",
        transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1), height 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      className:
        "relative select-none overflow-hidden rounded-xl shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-slate-800/80",
    },
    innerCanvas
  );
};
