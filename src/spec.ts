/**
 * Declarative Ad Specification & Strict TypeScript Types
 * 
 * Defines ad content, layout intent, semantic roles, and priorities independent of any surface.
 * Includes compile-time type safety and runtime validation to prevent invalid constraint combinations.
 */

export type ElementType = "text" | "image" | "button";

export type TextRole = "primary" | "secondary" | "legal" | "eyebrow";
export type ImageRole = "hero" | "branding" | "background";
export type ButtonRole = "action" | "secondary-action";

export type RoleForType<T extends ElementType> = 
  T extends "text" ? TextRole :
  T extends "image" ? ImageRole :
  T extends "button" ? ButtonRole : never;

export type ElementPriority = 1 | 2 | 3; // 1 = Critical (Hero/Headline), 2 = Secondary (Price/CTA), 3 = Discretionary (Logo/Branding)

export interface BaseElementSpec<T extends ElementType> {
  id: string;
  type: T;
  role: RoleForType<T>;
  priority: ElementPriority;
  allowDrop?: boolean;
  allowShrink?: boolean;
  allowTruncate?: boolean;
}

export interface TextElementSpec extends BaseElementSpec<"text"> {
  type: "text";
  content: string;
  minFontSize?: number;
  maxFontSize?: number;
  maxLines?: number;
  weight?: "normal" | "medium" | "bold" | "black";
}

export interface ImageElementSpec extends BaseElementSpec<"image"> {
  type: "image";
  src: string;
  alt: string;
  aspectRatio: number; // width / height
  minWidth?: number;
  minHeight?: number;
  objectFit?: "contain" | "cover";
}

export interface ButtonElementSpec extends BaseElementSpec<"button"> {
  type: "button";
  label: string;
  actionUrl?: string;
  minTapTarget?: number;
  variant?: "primary" | "secondary" | "accent";
}

export type AdElementSpec = TextElementSpec | ImageElementSpec | ButtonElementSpec;

export interface AdSpecMetadata {
  title: string;
  campaignId?: string;
  theme?: "dark" | "light" | "vibrant";
  brandName?: string;
}

export interface AdSpec {
  id: string;
  metadata?: AdSpecMetadata;
  elements: AdElementSpec[];
}

/**
 * Validates that an element spec does not contain contradictory or invalid constraints.
 */
export function validateElementSpec(element: AdElementSpec): { valid: boolean; error?: string } {
  if (!element.id || typeof element.id !== "string") {
    return { valid: false, error: "Element must have a valid string 'id'" };
  }

  if (element.priority !== 1 && element.priority !== 2 && element.priority !== 3) {
    return { valid: false, error: `Element '${element.id}' priority must be 1, 2, or 3` };
  }

  if (element.type === "text") {
    const textEl = element as TextElementSpec;
    if (typeof textEl.content !== "string") {
      return { valid: false, error: `Text element '${element.id}' requires string 'content'` };
    }
    if (textEl.minFontSize && textEl.maxFontSize && textEl.minFontSize > textEl.maxFontSize) {
      return { valid: false, error: `Text element '${element.id}' minFontSize cannot exceed maxFontSize` };
    }
    const validRoles: TextRole[] = ["primary", "secondary", "legal", "eyebrow"];
    if (!validRoles.includes(textEl.role)) {
      return { valid: false, error: `Invalid role '${textEl.role}' for text element '${element.id}'` };
    }
  } else if (element.type === "image") {
    const imgEl = element as ImageElementSpec;
    if (!imgEl.src) {
      return { valid: false, error: `Image element '${element.id}' requires 'src'` };
    }
    if (!imgEl.aspectRatio || imgEl.aspectRatio <= 0) {
      return { valid: false, error: `Image element '${element.id}' requires positive 'aspectRatio'` };
    }
    const validRoles: ImageRole[] = ["hero", "branding", "background"];
    if (!validRoles.includes(imgEl.role)) {
      return { valid: false, error: `Invalid role '${imgEl.role}' for image element '${element.id}'` };
    }
  } else if (element.type === "button") {
    const btnEl = element as ButtonElementSpec;
    if (!btnEl.label) {
      return { valid: false, error: `Button element '${element.id}' requires string 'label'` };
    }
    const validRoles: ButtonRole[] = ["action", "secondary-action"];
    if (!validRoles.includes(btnEl.role)) {
      return { valid: false, error: `Invalid role '${btnEl.role}' for button element '${element.id}'` };
    }
  }

  return { valid: true };
}

/**
 * Strongly-typed builder for declarative ad specs.
 * Guarantees compile-time constraints and validates runtime invariants.
 */
export function defineAd<T extends { elements: AdElementSpec[]; metadata?: AdSpecMetadata; id?: string }>(
  spec: T
): AdSpec {
  const adId = spec.id || `ad-${Date.now()}`;
  
  // Runtime uniqueness validation
  const idSet = new Set<string>();
  for (const element of spec.elements) {
    if (idSet.has(element.id)) {
      throw new Error(`Duplicate element ID '${element.id}' found in ad spec.`);
    }
    idSet.add(element.id);

    const validation = validateElementSpec(element);
    if (!validation.valid) {
      throw new Error(`Invalid AdSpec: ${validation.error}`);
    }
  }

  // Ensure at least one primary element exists
  const hasPrimary = spec.elements.some((el) => el.priority === 1);
  if (!hasPrimary) {
    throw new Error("AdSpec must contain at least one Priority 1 element.");
  }

  return {
    id: adId,
    metadata: spec.metadata,
    elements: spec.elements,
  };
}

/**
 * Standard Production Ad Spec (Matches Assignment Spec exactly)
 * Features headline, hero product image, action CTA, secondary price, and branding logo.
 */
export const defaultAdSpec = defineAd({
  id: "cyberpulse-anc-headphone-ad",
  metadata: {
    title: "CyberPulse Ultra Wireless ANC Headphones",
    brandName: "CyberPulse Studio",
    theme: "dark",
  },
  elements: [
    {
      id: "headline",
      type: "text",
      role: "primary",
      priority: 1,
      content: "CyberPulse Ultra Wireless ANC",
      weight: "black",
      minFontSize: 16,
      maxFontSize: 48,
      maxLines: 2,
    },
    {
      id: "product-image",
      type: "image",
      role: "hero",
      priority: 1,
      src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
      alt: "CyberPulse Studio Headphones",
      aspectRatio: 1.25, // 5:4 aspect ratio
      minWidth: 90,
      minHeight: 70,
      objectFit: "contain",
    },
    {
      id: "cta",
      type: "button",
      role: "action",
      priority: 2,
      label: "Claim 40% Off Now",
      actionUrl: "https://example.com/shop",
      minTapTarget: 44, // Accessible touch threshold
      variant: "primary",
    },
    {
      id: "price",
      type: "text",
      role: "secondary",
      priority: 2,
      content: "$199 (Regular $329) • Limited Time",
      weight: "bold",
      minFontSize: 13,
      maxFontSize: 24,
      maxLines: 1,
    },
    {
      id: "logo",
      type: "image",
      role: "branding",
      priority: 3,
      src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&q=80",
      alt: "CyberPulse Brand Emblem",
      aspectRatio: 2.5,
      minWidth: 60,
      minHeight: 24,
      objectFit: "contain",
      allowDrop: true,
    },
  ],
});
