/**
 * Edge-detection-based alignment scoring.
 *
 * Since react-native-vision-camera frame processors run as JS worklets,
 * we perform a lightweight edge comparison on downscaled frames:
 *
 *   1. Extract small patches around each anchor point
 *   2. Compute gradient magnitude (simplified Sobel) for each patch
 *   3. Compare edge density against expected template values
 *   4. Return aggregate alignment score (0–1)
 */

interface AnchorPointLike {
    x: number;
    y: number;
    type: string;
}

/* ── Expected edge densities per anchor type ── */
const EXPECTED_EDGE_DENSITY: Record<string, number> = {
    light: 0.55,    // headlights/taillights have high contrast edges
    mirror: 0.45,   // mirrors have moderate edges
    wheel: 0.5,     // wheels have spoke edges
    edge: 0.4,      // body edges/bumpers
    vent: 0.35,     // vents, grilles
    gauge: 0.4,     // dashboard elements
    interior: 0.3,  // interior elements
};

/* ── Sobel gradient magnitude for a single pixel ── */
function sobelMagnitude(
    pixels: Uint8Array,
    w: number,
    x: number,
    y: number,
): number {
    const idx = (r: number, c: number) => r * w + c;
    const tl = pixels[idx(y - 1, x - 1)];
    const tc = pixels[idx(y - 1, x)];
    const tr = pixels[idx(y - 1, x + 1)];
    const ml = pixels[idx(y, x - 1)];
    const mr = pixels[idx(y, x + 1)];
    const bl = pixels[idx(y + 1, x - 1)];
    const bc = pixels[idx(y + 1, x)];
    const br = pixels[idx(y + 1, x + 1)];

    const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
    const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

    return Math.sqrt(gx * gx + gy * gy);
}

/* ── Compute edge density in a patch around (cx, cy) ── */
export function patchEdgeDensity(
    grayscale: Uint8Array,
    width: number,
    height: number,
    cx: number,   // center x in pixels
    cy: number,   // center y in pixels
    patchRadius: number = 8,
): number {
    let edgeSum = 0;
    let count = 0;

    const x0 = Math.max(1, cx - patchRadius);
    const x1 = Math.min(width - 2, cx + patchRadius);
    const y0 = Math.max(1, cy - patchRadius);
    const y1 = Math.min(height - 2, cy + patchRadius);

    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            edgeSum += sobelMagnitude(grayscale, width, x, y);
            count++;
        }
    }

    if (count === 0) return 0;

    // Normalize: max possible Sobel magnitude is ~1442 (sqrt(2) * 1020)
    const avgMag = edgeSum / count;
    return Math.min(1, avgMag / 200); // scale so typical edges → 0.3–0.7
}

/* ── Score alignment for a set of anchors ── */
export function computeAlignmentScore(
    grayscale: Uint8Array,
    frameWidth: number,
    frameHeight: number,
    anchors: AnchorPointLike[],
): number {
    if (anchors.length === 0) return 0;

    let totalScore = 0;

    for (const anchor of anchors) {
        // Convert normalized anchor coords to frame pixel coords
        const px = Math.round(anchor.x * frameWidth);
        const py = Math.round(anchor.y * frameHeight);

        const density = patchEdgeDensity(
            grayscale, frameWidth, frameHeight, px, py, 8,
        );

        const expected = EXPECTED_EDGE_DENSITY[anchor.type] ?? 0.4;

        // Score = 1 - |actual - expected| / expected
        // Clamp to [0, 1]
        const diff = Math.abs(density - expected) / Math.max(expected, 0.01);
        const anchorScore = Math.max(0, 1 - diff);

        totalScore += anchorScore;
    }

    return totalScore / anchors.length;
}

/* ── Convert RGBA buffer to grayscale ── */
export function rgbaToGrayscale(
    rgba: Uint8Array,
    width: number,
    height: number,
): Uint8Array {
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const r = rgba[i * 4];
        const g = rgba[i * 4 + 1];
        const b = rgba[i * 4 + 2];
        gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    return gray;
}
