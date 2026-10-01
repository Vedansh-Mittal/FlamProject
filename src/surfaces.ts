/**
 * Surface Profile Constraints
 * 
 * Defines physical display surfaces with concrete constraints:
 * - Dimensions (width & height)
 * - Safe area insets (notches, broadcast action-safe margins, physical bezel clearance)
 * - Interaction modalities (touchOnly, mouse/remote)
 * - Minimum accessibility tap target size (e.g., 44px for iOS, 60px for kiosk)
 * - Viewing distance ("near" ~30cm, "medium" ~1m, "far" ~3m+ such as TV / billboards)
 * - Text scale multiplier / minimum readable text sizes
 */

export type ViewingDistance = "near" | "medium" | "far";

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SurfaceProfile {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  safeArea: SafeAreaInsets;
  minTapTarget?: number;
  minTextSize?: number;
  viewingDistance: ViewingDistance;
  touchOnly?: boolean;
  colorDepth?: "8bit" | "10bit";
  aspectRatioLabel?: string;
}

/**
 * Standard Surface Profiles as specified in the assignment
 */
export const standardSurfaces: Record<string, SurfaceProfile> = {
  mobilePortrait: {
    id: "mobile-portrait",
    name: "Mobile Portrait",
    description: "Compact vertical viewport with status bar and home indicator insets",
    width: 320,
    height: 480,
    safeArea: { top: 28, bottom: 28, left: 16, right: 16 },
    minTapTarget: 44,
    minTextSize: 13,
    viewingDistance: "near",
    touchOnly: true,
    aspectRatioLabel: "2:3 (Portrait)",
  },

  mobileLandscape: {
    id: "mobile-landscape",
    name: "Mobile Landscape",
    description: "Wide horizontal mobile viewport with camera notch side margins",
    width: 480,
    height: 320,
    safeArea: { top: 16, bottom: 16, left: 32, right: 32 },
    minTapTarget: 44,
    minTextSize: 13,
    viewingDistance: "near",
    touchOnly: true,
    aspectRatioLabel: "3:2 (Landscape)",
  },

  broadcastLowerThird: {
    id: "broadcast-lower-third",
    name: "Broadcast Lower-Third",
    description: "Ultra-wide TV overlay banner with EBU action-safe bounds & far viewing distance",
    width: 1920,
    height: 250,
    safeArea: { top: 18, bottom: 18, left: 80, right: 80 },
    viewingDistance: "far",
    minTextSize: 32, // Essential for legibility from 10 feet away
    touchOnly: false,
    minTapTarget: 0,
    aspectRatioLabel: "7.68:1 (Ultra-Wide Banner)",
  },

  retailKiosk: {
    id: "retail-kiosk",
    name: "Retail Kiosk Screen",
    description: "Square standing public interactive terminal with large touch targets",
    width: 1080,
    height: 1080,
    safeArea: { top: 48, bottom: 48, left: 48, right: 48 },
    touchOnly: true,
    minTapTarget: 60, // Kiosk accessibility standard for arm-reach interaction
    minTextSize: 20,
    viewingDistance: "medium",
    aspectRatioLabel: "1:1 (Square)",
  },

  smartWatch: {
    id: "smart-watch",
    name: "Smart Watch / Wearable",
    description: "Ultra-constrained circular/squircle screen with aggressive space limitations",
    width: 280,
    height: 280,
    safeArea: { top: 18, bottom: 18, left: 18, right: 18 },
    touchOnly: true,
    minTapTarget: 48,
    minTextSize: 12,
    viewingDistance: "near",
    aspectRatioLabel: "1:1 (Micro-Display)",
  },

  digitalBillboard: {
    id: "digital-billboard",
    name: "Highway Digital Billboard",
    description: "Distant outdoor high-contrast LED sign requiring maximum legibility",
    width: 2560,
    height: 480,
    safeArea: { top: 24, bottom: 24, left: 64, right: 64 },
    touchOnly: false,
    minTapTarget: 0,
    minTextSize: 42,
    viewingDistance: "far",
    aspectRatioLabel: "5.33:1 (Super-Wide)",
  },
};

/**
 * Creates a validated custom surface profile for live interactive testing
 */
export function createCustomSurface(
  params: Partial<SurfaceProfile> & { width: number; height: number; name?: string }
): SurfaceProfile {
  const width = Math.max(120, Math.min(params.width, 3840));
  const height = Math.max(80, Math.min(params.height, 2160));
  const viewingDistance = params.viewingDistance || (width >= 1600 && height <= 350 ? "far" : "near");
  const minTapTarget = params.touchOnly !== false ? (params.minTapTarget ?? 44) : 0;
  const minTextSize = params.minTextSize ?? (viewingDistance === "far" ? 32 : 12);

  const safeArea: SafeAreaInsets = params.safeArea ?? {
    top: Math.round(height * 0.05),
    bottom: Math.round(height * 0.05),
    left: Math.round(width * 0.05),
    right: Math.round(width * 0.05),
  };

  const ratio = (width / height).toFixed(2);

  return {
    id: params.id || `custom-${width}x${height}`,
    name: params.name || `Custom (${width}×${height})`,
    description: params.description || `Custom live profile with ${width}x${height} resolution`,
    width,
    height,
    safeArea,
    minTapTarget,
    minTextSize,
    viewingDistance,
    touchOnly: params.touchOnly ?? true,
    aspectRatioLabel: `${ratio}:1`,
  };
}
