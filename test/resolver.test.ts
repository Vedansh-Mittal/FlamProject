import { defaultAdSpec, defineAd } from "../src/spec";
import { standardSurfaces, createCustomSurface } from "../src/surfaces";
import { resolveLayout } from "../src/resolver";

console.log("=== ADAPTIVE LAYOUT ENGINE VERIFICATION TEST SUITE ===\n");

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exitCode = 1;
  }
}

// 1. Mobile Portrait
console.log("1. Testing Mobile Portrait (320x480):");
const mobileRes = resolveLayout(defaultAdSpec, standardSurfaces.mobilePortrait);
assert(mobileRes.layoutMode === "vertical-stack", "Selects vertical-stack orientation for portrait aspect ratio");
assert(!mobileRes.diagnostics.hasCollisions, "Zero collisions detected between elements");
assert(mobileRes.elements["cta"].minTapTargetMet === true, "CTA button meets or exceeds 44px minTapTarget");
assert(mobileRes.diagnostics.resolutionTimeMs < 10, `Fast execution time: ${mobileRes.diagnostics.resolutionTimeMs}ms (<10ms)`);

// 2. Mobile Landscape
console.log("\n2. Testing Mobile Landscape (480x320):");
const landscapeRes = resolveLayout(defaultAdSpec, standardSurfaces.mobileLandscape);
assert(landscapeRes.layoutMode === "horizontal-split", "Selects horizontal-split orientation for landscape aspect ratio");
assert(!landscapeRes.diagnostics.hasCollisions, "Zero collisions in split columns");
assert(landscapeRes.elements["product-image"].width > 100, "Hero image allocated substantial media column");

// 3. Broadcast Lower-Third
console.log("\n3. Testing Broadcast Lower-Third (1920x250):");
const broadcastRes = resolveLayout(defaultAdSpec, standardSurfaces.broadcastLowerThird);
assert(broadcastRes.layoutMode === "cinema-wide-strip", "Selects cinema-wide-strip ribbon orientation");
assert(!broadcastRes.diagnostics.hasCollisions, "Zero collisions across horizontal strip");
assert((broadcastRes.elements["headline"].fontSize || 0) >= 32, "Headline satisfies minTextSize of 32px for far viewing distance");

// 4. Retail Kiosk
console.log("\n4. Testing Retail Kiosk (1080x1080):");
const kioskRes = resolveLayout(defaultAdSpec, standardSurfaces.retailKiosk);
assert(kioskRes.layoutMode === "multi-column-grid", "Selects multi-column-grid for square 1:1 screen");
assert(kioskRes.elements["cta"].height >= 60, "Kiosk CTA enforces 60px tap target for arm-reach touch");
assert(!kioskRes.diagnostics.hasCollisions, "Zero collisions on kiosk");

// 5. Priority Degradation: Extreme Space Compression
console.log("\n5. Testing Priority-Based Degradation Loop under Space Deficit:");
const tightSurface = createCustomSurface({
  width: 300,
  height: 220, // severely constrained height
  name: "Extreme Height Deficit",
  touchOnly: true,
});
const tightRes = resolveLayout(defaultAdSpec, tightSurface);
assert(tightRes.elements["logo"].visible === false, "Priority 3 Logo/Branding dropped cleanly when height is starved");
assert(tightRes.elements["headline"].visible === true, "Priority 1 Headline remains visible and intact");
assert(tightRes.elements["cta"].visible === true, "Priority 2 Action CTA remains visible and intact");
assert(!tightRes.diagnostics.hasCollisions, "Zero collisions even under aggressive degradation");
assert(tightRes.droppedElementIds.includes("logo"), "Diagnostics records 'logo' in droppedElementIds");

// 6. Arbitrary 5th Surface Profile (Smart Watch / Wearable)
console.log("\n6. Testing 5th Surface Profile (Smart Watch 280x280):");
const watchRes = resolveLayout(defaultAdSpec, standardSurfaces.smartWatch);
assert(watchRes.elements["headline"].visible === true, "Watch resolves headline within micro-display");
assert(!watchRes.diagnostics.hasCollisions, "Zero collisions on smartwatch screen");

console.log(`\n========================================`);
console.log(`Result: ${passed}/${total} tests passed!`);
if (passed === total) {
  console.log("All constraint solver assertions PASSED flawlessly!");
}
