/**
 * Alignment engine — computes the mean-absolute-error between
 * template reference anchors and user-placed marker positions.
 *
 * E = (1/n) Σ |Rᵢ − Cᵢ|    (Euclidean distance per anchor)
 *
 * isAligned = E < ε
 */

export interface AnchorPoint {
    id: string;
    label: string;
    /** Normalised x within the overlay (0–1). */
    x: number;
    /** Normalised y within the overlay (0–1). */
    y: number;
    type: 'light' | 'mirror' | 'wheel' | 'exhaust' | 'edge' | 'gauge' | 'steering';
}

export interface MarkerPosition {
    id: string;
    x: number;
    y: number;
}

interface AlignmentResult {
    /** Mean absolute error across all anchors (0 = perfect). */
    error: number;
    /** True when error < tolerance. */
    isAligned: boolean;
    /** Per-anchor distance (same order as anchors). */
    distances: number[];
}

/**
 * Compute the alignment error between reference anchors and
 * user-placed marker positions.
 *
 * @param anchors  Reference points from the template (normalised 0–1).
 * @param markers  Current positions the user dragged to (normalised 0–1).
 * @param tolerance  Epsilon — maximum mean error to be considered aligned. Default 0.05 (5%).
 */
export function computeAlignment(
    anchors: AnchorPoint[],
    markers: MarkerPosition[],
    tolerance = 0.05,
): AlignmentResult {
    if (anchors.length === 0) {
        return { error: 0, isAligned: true, distances: [] };
    }

    const markerMap = new Map(markers.map(m => [m.id, m]));

    const distances = anchors.map(anchor => {
        const marker = markerMap.get(anchor.id);
        if (!marker) return 1; // missing marker → max distance
        const dx = anchor.x - marker.x;
        const dy = anchor.y - marker.y;
        return Math.sqrt(dx * dx + dy * dy);
    });

    const error = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    return {
        error,
        isAligned: error < tolerance,
        distances,
    };
}
