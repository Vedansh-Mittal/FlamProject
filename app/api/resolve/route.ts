import { NextRequest, NextResponse } from "next/server";
import { resolveLayout, ResolvedLayout } from "@/src/resolver";
import { defaultAdSpec, defineAd, AdSpec, validateElementSpec } from "@/src/spec";
import { standardSurfaces, SurfaceProfile, createCustomSurface } from "@/src/surfaces";

interface ResolveRequestBody {
  adSpec?: AdSpec;
  surfaceProfile?: SurfaceProfile;
  surfaceId?: string;
  customSurface?: Partial<SurfaceProfile> & { width: number; height: number };
}

/**
 * GET /api/resolve
 * Informational endpoint returning health status, available surfaces, and engine capabilities.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    engine: "Adaptive Layout Constraint Solver v1.0",
    standardSurfaces: Object.keys(standardSurfaces).map((key) => ({
      key,
      ...standardSurfaces[key],
    })),
    defaultSpec: defaultAdSpec,
  });
}

/**
 * POST /api/resolve
 * Core API endpoint to resolve an AdSpec across an arbitrary SurfaceProfile.
 */
export async function POST(req: NextRequest) {
  const reqStart = performance.now();

  try {
    let body: ResolveRequestBody;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    // 1. Resolve AdSpec
    let activeSpec: AdSpec;
    if (body.adSpec) {
      // Validate provided spec
      if (!Array.isArray(body.adSpec.elements) || body.adSpec.elements.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "AdSpec must contain a non-empty 'elements' array",
          },
          { status: 400 }
        );
      }

      for (const el of body.adSpec.elements) {
        const val = validateElementSpec(el);
        if (!val.valid) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid element spec: ${val.error}`,
            },
            { status: 400 }
          );
        }
      }

      try {
        activeSpec = defineAd(body.adSpec);
      } catch (specErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: specErr.message || "Failed to validate AdSpec",
          },
          { status: 400 }
        );
      }
    } else {
      activeSpec = defaultAdSpec;
    }

    // 2. Resolve SurfaceProfile
    let activeSurface: SurfaceProfile;
    if (body.surfaceProfile) {
      const sp = body.surfaceProfile;
      if (!sp.width || sp.width <= 0 || !sp.height || sp.height <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "surfaceProfile must have positive 'width' and 'height'",
          },
          { status: 400 }
        );
      }
      activeSurface = sp;
    } else if (body.customSurface) {
      activeSurface = createCustomSurface(body.customSurface);
    } else if (body.surfaceId && standardSurfaces[body.surfaceId]) {
      activeSurface = standardSurfaces[body.surfaceId];
    } else {
      activeSurface = standardSurfaces.mobilePortrait;
    }

    // 3. Execute Pure Constraint Solver
    const layout: ResolvedLayout = resolveLayout(activeSpec, activeSurface);

    const totalServerDurationMs = Math.round((performance.now() - reqStart) * 100) / 100;

    return NextResponse.json(
      {
        success: true,
        meta: {
          serverProcessingTimeMs: totalServerDurationMs,
          solverAlgorithmTimeMs: layout.diagnostics.resolutionTimeMs,
          timestamp: new Date().toISOString(),
        },
        layout,
      },
      {
        status: 200,
        headers: {
          "Server-Timing": `solver;dur=${layout.diagnostics.resolutionTimeMs}, total;dur=${totalServerDurationMs}`,
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Internal constraint resolution error",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
