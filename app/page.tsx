"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { defaultAdSpec, AdSpec } from "@/src/spec";
import { standardSurfaces, SurfaceProfile, createCustomSurface } from "@/src/surfaces";
import { resolveLayout, ResolvedLayout } from "@/src/resolver";
import { AdDomRenderer } from "@/src/render-dom";
import { renderToCanvas } from "@/src/render-canvas";
import {
  Smartphone,
  Tv,
  Monitor,
  Watch,
  Sliders,
  Code,
  Layers,
  Sparkles,
  ShieldAlert,
  Zap,
  Activity,
  Maximize2,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Send,
  HelpCircle,
} from "lucide-react";

export default function AdaptiveLayoutDashboard() {
  // State: selected surface preset or custom
  const [selectedSurfaceKey, setSelectedSurfaceKey] = useState<string>("mobilePortrait");

  // Custom surface parameters
  const [customWidth, setCustomWidth] = useState<number>(360);
  const [customHeight, setCustomHeight] = useState<number>(420);
  const [customDistance, setCustomDistance] = useState<"near" | "medium" | "far">("near");
  const [customTouchOnly, setCustomTouchOnly] = useState<boolean>(true);

  // Live Space-Degradation Slider (1.0 = 100% normal size, 0.35 = severe deficit)
  const [spaceCompression, setSpaceCompression] = useState<number>(1.0);

  // Display toggles
  const [showSafeAreas, setShowSafeAreas] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(false);
  const [highlightDegraded, setHighlightDegraded] = useState<boolean>(true);
  const [rendererMode, setRendererMode] = useState<"dom" | "canvas">("dom");
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);

  // Inspector active tab
  const [activeTab, setActiveTab] = useState<"coordinates" | "audit" | "json" | "spec" | "api">("coordinates");

  // API Route state
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(false);

  // Canvas ref for canvas renderer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute active surface profile based on selection and space degradation
  const activeSurface: SurfaceProfile = useMemo(() => {
    let base: SurfaceProfile;
    if (selectedSurfaceKey === "custom") {
      base = createCustomSurface({
        width: customWidth,
        height: customHeight,
        viewingDistance: customDistance,
        touchOnly: customTouchOnly,
      });
    } else {
      base = standardSurfaces[selectedSurfaceKey] || standardSurfaces.mobilePortrait;
    }

    // Apply live space compression slider
    if (spaceCompression !== 1.0) {
      const compressedW = Math.max(120, Math.round(base.width * Math.sqrt(spaceCompression)));
      const compressedH = Math.max(80, Math.round(base.height * Math.sqrt(spaceCompression)));
      return {
        ...base,
        width: compressedW,
        height: compressedH,
        safeArea: {
          top: Math.round(base.safeArea.top * Math.sqrt(spaceCompression)),
          bottom: Math.round(base.safeArea.bottom * Math.sqrt(spaceCompression)),
          left: Math.round(base.safeArea.left * Math.sqrt(spaceCompression)),
          right: Math.round(base.safeArea.right * Math.sqrt(spaceCompression)),
        },
      };
    }

    return base;
  }, [selectedSurfaceKey, customWidth, customHeight, customDistance, customTouchOnly, spaceCompression]);

  // Compute resolved layout using pure TypeScript engine
  const resolvedLayout: ResolvedLayout = useMemo(() => {
    return resolveLayout(defaultAdSpec, activeSurface);
  }, [activeSurface]);

  // Auto-fit zoom based on surface dimensions
  useEffect(() => {
    const maxPreviewW = 680;
    const maxPreviewH = 460;
    const fitW = maxPreviewW / activeSurface.width;
    const fitH = maxPreviewH / activeSurface.height;
    const optimal = Math.min(1.0, Math.min(fitW, fitH));
    setPreviewZoom(Math.max(0.2, Math.round(optimal * 100) / 100));
  }, [activeSurface.width, activeSurface.height]);

  // Render to canvas if canvas mode is chosen
  useEffect(() => {
    if (rendererMode === "canvas" && canvasRef.current) {
      renderToCanvas(canvasRef.current, resolvedLayout, defaultAdSpec, {
        showSafeAreas,
        showBoundingBoxes,
        highlightDegraded,
      });
    }
  }, [rendererMode, resolvedLayout, showSafeAreas, showBoundingBoxes, highlightDegraded]);

  // Test API endpoint
  const handleTestApi = async () => {
    setApiLoading(true);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adSpec: defaultAdSpec,
          surfaceProfile: activeSurface,
        }),
      });
      const data = await res.json();
      setApiResponse(data);
    } catch (e: any) {
      setApiResponse({ error: e.message });
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-indigo-500/25">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold tracking-tight text-white">Adaptive Layout Engine</h1>
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                  Pure TS Solver
                </span>
              </div>
              <p className="text-xs text-slate-400">Algorithmic constraint-solving for multi-surface ads</p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-slate-400">Solver:</span>
              <span className="font-mono font-bold text-emerald-400">
                {resolvedLayout.diagnostics.resolutionTimeMs.toFixed(2)} ms
              </span>
            </div>

            <div className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-slate-400">Mode:</span>
              <span className="font-mono font-bold text-indigo-300">
                {resolvedLayout.layoutMode}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-slate-400">Elements:</span>
              <span className="font-mono font-bold text-slate-200">
                {resolvedLayout.elementList.filter((e) => e.visible).length}/
                {resolvedLayout.elementList.length} visible
              </span>
              {resolvedLayout.droppedElementIds.length > 0 && (
                <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[10px] font-bold text-rose-300">
                  {resolvedLayout.droppedElementIds.length} dropped
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 md:p-6 gap-6">
        {/* Surface Selector Bar */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedSurfaceKey("mobilePortrait");
                  setSpaceCompression(1.0);
                }}
                className={`flex items-center space-x-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  selectedSurfaceKey === "mobilePortrait"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>Mobile Portrait</span>
                <span className="text-[10px] opacity-70">320×480</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedSurfaceKey("mobileLandscape");
                  setSpaceCompression(1.0);
                }}
                className={`flex items-center space-x-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  selectedSurfaceKey === "mobileLandscape"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Smartphone className="h-4 w-4 rotate-90" />
                <span>Mobile Landscape</span>
                <span className="text-[10px] opacity-70">480×320</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedSurfaceKey("broadcastLowerThird");
                  setSpaceCompression(1.0);
                }}
                className={`flex items-center space-x-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  selectedSurfaceKey === "broadcastLowerThird"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Tv className="h-4 w-4" />
                <span>Broadcast Lower-Third</span>
                <span className="text-[10px] opacity-70">1920×250</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedSurfaceKey("retailKiosk");
                  setSpaceCompression(1.0);
                }}
                className={`flex items-center space-x-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  selectedSurfaceKey === "retailKiosk"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Monitor className="h-4 w-4" />
                <span>Retail Kiosk</span>
                <span className="text-[10px] opacity-70">1080×1080</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedSurfaceKey("smartWatch");
                  setSpaceCompression(1.0);
                }}
                className={`flex items-center space-x-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  selectedSurfaceKey === "smartWatch"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Watch className="h-4 w-4" />
                <span>Smart Watch (5th)</span>
                <span className="text-[10px] opacity-70">280×280</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSurfaceKey("custom")}
                className={`flex items-center space-x-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  selectedSurfaceKey === "custom"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Sliders className="h-4 w-4" />
                <span>Custom Profile</span>
              </button>
            </div>

            {/* Renderer Switcher */}
            <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setRendererMode("dom")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  rendererMode === "dom" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                DOM Renderer
              </button>
              <button
                type="button"
                onClick={() => setRendererMode("canvas")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  rendererMode === "canvas" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Canvas (2D)
              </button>
            </div>
          </div>

          {/* Custom Surface Controls (if custom selected) */}
          {selectedSurfaceKey === "custom" && (
            <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs animate-in fade-in duration-300">
              <div>
                <label className="text-slate-400 block mb-1">Width (px): {customWidth}</label>
                <input
                  type="range"
                  min="200"
                  max="2560"
                  step="20"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Height (px): {customHeight}</label>
                <input
                  type="range"
                  min="120"
                  max="1440"
                  step="20"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Viewing Distance</label>
                <select
                  value={customDistance}
                  onChange={(e) => setCustomDistance(e.target.value as any)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-slate-200"
                >
                  <option value="near">Near (~30cm Handheld)</option>
                  <option value="medium">Medium (~1m Kiosk)</option>
                  <option value="far">Far (3m+ Broadcast / Billboard)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <input
                  type="checkbox"
                  id="customTouch"
                  checked={customTouchOnly}
                  onChange={(e) => setCustomTouchOnly(e.target.checked)}
                  className="rounded border-slate-700 accent-purple-500 h-4 w-4"
                />
                <label htmlFor="customTouch" className="text-slate-300 font-medium">
                  Touchscreen (minTapTarget: 44px)
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Space-Degradation Slider Bar */}
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-amber-200">Live Space-Degradation Slider</h2>
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                    {Math.round(spaceCompression * 100)}% Available Space
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Drag left to starve vertical/horizontal budget: watch Priority 3 Logo drop out, then Priority 2 Price condense.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 flex-1 max-w-md">
              <span className="text-[11px] font-mono text-slate-500">35% Deficit</span>
              <input
                type="range"
                min="0.35"
                max="1.0"
                step="0.02"
                value={spaceCompression}
                onChange={(e) => setSpaceCompression(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-800 accent-amber-400 cursor-pointer"
              />
              <span className="text-[11px] font-mono text-emerald-400">100% Full</span>
              <button
                type="button"
                onClick={() => setSpaceCompression(1.0)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                title="Reset to 100%"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Workspace: Visual Preview Stage (Left) & Inspector (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Visual Stage (7 Columns) */}
          <section className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Ad Canvas Preview</h3>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                  {activeSurface.width} × {activeSurface.height} px
                </span>
                <span className="text-xs text-slate-400">({activeSurface.aspectRatioLabel || "Custom"})</span>
              </div>

              {/* View options */}
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowSafeAreas(!showSafeAreas)}
                  className={`rounded-lg px-2.5 py-1 border transition-colors ${
                    showSafeAreas
                      ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                      : "border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                  title="Toggle safe area guideline"
                >
                  Safe Area
                </button>
                <button
                  type="button"
                  onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                  className={`rounded-lg px-2.5 py-1 border transition-colors ${
                    showBoundingBoxes
                      ? "border-pink-500/50 bg-pink-500/20 text-pink-300"
                      : "border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                  title="Toggle AABB bounding wireframes"
                >
                  Wireframes
                </button>
                <button
                  type="button"
                  onClick={() => setHighlightDegraded(!highlightDegraded)}
                  className={`rounded-lg px-2.5 py-1 border transition-colors ${
                    highlightDegraded
                      ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                      : "border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                  title="Highlight degraded items"
                >
                  Highlight Degraded
                </button>
              </div>
            </div>

            {/* Viewport Frame with Zoom */}
            <div className="relative flex min-h-[480px] flex-1 items-center justify-center overflow-auto rounded-xl bg-slate-950/80 p-6 border border-slate-900 shadow-inner">
              {rendererMode === "dom" ? (
                <AdDomRenderer
                  layout={resolvedLayout}
                  spec={defaultAdSpec}
                  scale={previewZoom}
                  options={{
                    showSafeAreas,
                    showBoundingBoxes,
                    highlightDegraded,
                  }}
                />
              ) : (
                <div
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: "center center",
                    transition: "all 0.3s ease",
                  }}
                  className="rounded-xl overflow-hidden shadow-2xl border border-slate-800"
                >
                  <canvas ref={canvasRef} />
                </div>
              )}
            </div>

            {/* Bottom Stage Bar: Zoom Controls & Surface Specs */}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
              <div className="flex items-center space-x-3">
                <span>
                  Viewing Distance: <strong className="text-slate-200 capitalize">{activeSurface.viewingDistance}</strong>
                </span>
                <span>•</span>
                <span>
                  Min Tap Target: <strong className="text-slate-200">{activeSurface.minTapTarget || 0}px</strong>
                </span>
                <span>•</span>
                <span>
                  Safe Insets:{" "}
                  <strong className="text-slate-200 font-mono">
                    [{activeSurface.safeArea.top}, {activeSurface.safeArea.right}, {activeSurface.safeArea.bottom}, {activeSurface.safeArea.left}]
                  </strong>
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span>Scale:</span>
                <input
                  type="range"
                  min="0.15"
                  max="1.5"
                  step="0.05"
                  value={previewZoom}
                  onChange={(e) => setPreviewZoom(Number(e.target.value))}
                  className="w-24 accent-indigo-500"
                />
                <span className="font-mono text-slate-300 w-10 text-right">{Math.round(previewZoom * 100)}%</span>
              </div>
            </div>
          </section>

          {/* Inspector Panel (5 Columns) */}
          <section className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 shadow-2xl backdrop-blur">
            {/* Tabs Header */}
            <div className="flex items-center space-x-1 border-b border-slate-800/80 pb-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("coordinates")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeTab === "coordinates"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Boxes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeTab === "audit"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Audit Log</span>
                {resolvedLayout.diagnostics.pass3DegradationSteps.length > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 text-[9px] text-amber-300">
                    {resolvedLayout.diagnostics.pass3DegradationSteps.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("json")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeTab === "json"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Code className="h-3.5 w-3.5" />
                <span>Resolved JSON</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("spec")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeTab === "spec"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Input Spec</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("api")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeTab === "api"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                <span>API Test</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-auto mt-4 text-xs font-mono max-h-[500px]">
              {/* Tab 1: Coordinates Table */}
              {activeTab === "coordinates" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <div className="flex items-center justify-between text-slate-400 font-sans">
                      <span className="font-semibold text-slate-200">Topology:</span>
                      <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-indigo-300">
                        {resolvedLayout.layoutMode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 font-sans">
                      <span>Usable Safe Bounds:</span>
                      <span className="font-mono text-slate-200">
                        {resolvedLayout.safeBounds.width} × {resolvedLayout.safeBounds.height} px
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 font-sans">
                      <span>Area Packing Efficiency:</span>
                      <span className="font-mono text-emerald-400">
                        {resolvedLayout.diagnostics.packingEfficiency}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 font-sans">
                      <span>Collisions Detected:</span>
                      <span className={`font-mono ${resolvedLayout.diagnostics.hasCollisions ? "text-rose-400 font-bold" : "text-emerald-400"}`}>
                        {resolvedLayout.diagnostics.hasCollisions ? "YES (Error)" : "None (Passed)"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {resolvedLayout.elementList.map((box) => (
                      <div
                        key={box.id}
                        className={`rounded-xl border p-3 transition-colors ${
                          !box.visible
                            ? "border-rose-900/60 bg-rose-950/20 opacity-60"
                            : box.degradationLevel > 0
                            ? "border-amber-600/40 bg-amber-950/20"
                            : "border-slate-800 bg-slate-950"
                        }`}
                      >
                        <div className="flex items-center justify-between font-sans mb-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white">{box.id}</span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                              P{box.priority}
                            </span>
                            <span className="text-[10px] text-slate-500 capitalize">{box.role}</span>
                          </div>

                          {!box.visible ? (
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                              DROPPED
                            </span>
                          ) : box.shrunk ? (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              SHRUNK
                            </span>
                          ) : box.truncated ? (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              CONDENSED
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              PRISTINE
                            </span>
                          )}
                        </div>

                        {box.visible ? (
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-400 text-[11px]">
                            <div>
                              X, Y: <strong className="text-slate-200">({box.x}, {box.y})</strong>
                            </div>
                            <div>
                              W × H: <strong className="text-slate-200">{box.width} × {box.height} px</strong>
                            </div>
                            {box.fontSize && (
                              <div>
                                Font: <strong className="text-indigo-300">{box.fontSize}px</strong>
                              </div>
                            )}
                            {box.minTapTargetMet && (
                              <div className="text-emerald-400 flex items-center space-x-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Tap: ≥{box.height}px</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-rose-400 italic font-sans">{box.dropReason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Audit Log */}
              {activeTab === "audit" && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 mb-3">
                    <h4 className="font-sans font-bold text-slate-200 mb-1">Pass 3 Degradation Trace</h4>
                    <p className="font-sans text-slate-400 text-[11px]">
                      Deterministic priority-ordered relaxation cascade executed by resolver.ts:
                    </p>
                  </div>

                  {resolvedLayout.diagnostics.pass3DegradationSteps.length === 0 ? (
                    <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                      <p className="font-sans font-semibold text-emerald-300">No Degradation Needed</p>
                      <p className="font-sans text-slate-400 text-[11px] mt-1">
                        All elements fit comfortably within safe viewport bounds at pristine fidelity.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {resolvedLayout.diagnostics.pass3DegradationSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start space-x-2 rounded-lg border border-amber-900/40 bg-slate-950 p-2.5"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="text-slate-300 font-sans text-[11px] leading-relaxed">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Resolved JSON */}
              {activeTab === "json" && (
                <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-emerald-400 overflow-x-auto leading-relaxed">
                  {JSON.stringify(resolvedLayout, null, 2)}
                </pre>
              )}

              {/* Tab 4: Input Spec */}
              {activeTab === "spec" && (
                <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-indigo-300 overflow-x-auto leading-relaxed">
                  {JSON.stringify(defaultAdSpec, null, 2)}
                </pre>
              )}

              {/* Tab 5: API Test Runner */}
              {activeTab === "api" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <h4 className="font-sans font-bold text-slate-200 mb-1">Live Backend Route Evaluation</h4>
                    <p className="font-sans text-slate-400 text-[11px] mb-3">
                      Dispatch a POST request to <code className="text-indigo-400">/api/resolve</code> with the active
                      spec and current surface profile.
                    </p>

                    <button
                      type="button"
                      disabled={apiLoading}
                      onClick={handleTestApi}
                      className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 font-sans font-bold text-white shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                      <span>{apiLoading ? "Solving on Server..." : "Execute POST /api/resolve"}</span>
                    </button>
                  </div>

                  {apiResponse && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="flex items-center justify-between mb-2 font-sans">
                        <span className="font-bold text-slate-300">API Response Payload:</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Status 200 OK</span>
                      </div>
                      <pre className="text-purple-300 overflow-x-auto max-h-[300px] leading-relaxed">
                        {JSON.stringify(apiResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500">
        <p>
          Adaptive Layout Engine • Assignment for Flam • Pure TypeScript Resolver with Zero CSS Media Queries
        </p>
      </footer>
    </div>
  );
}
