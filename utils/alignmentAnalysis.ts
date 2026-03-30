import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type AlignmentResult = {
    score: number;
    sceneNoise: number;
    bodyNoise: number;
    anchorDetails: {
        complexity: number;
        threshold: number;
        ratio: number;
        reqRatio: number;
        pass: boolean;
    }[];
    symmetryRatio: number;
    reasons: string[];
    error?: string;
};

/**
 * For each anchor point, crop a small patch from the image and measure
 * its JPEG base64 length. JPEG compression produces longer strings for
 * visually complex regions (edges, features) and shorter strings for
 * uniform areas (sky, plain surfaces).
 *
 * Scoring:
 * 1. Each anchor patch is scored by its base64 length vs expected thresholds
 * 2. Patches that are too uniform (short base64) score low → feature missing
 * 3. We also check variance between patches → uniform scenes score lower
 */
export async function analyzeAlignmentByCrops(
    imageUri: string,
    width: number,
    height: number,
    anchors: { x: number; y: number; type: string }[],
): Promise<AlignmentResult> {
    const details: AlignmentResult = {
        score: 0,
        sceneNoise: 0,
        bodyNoise: 0,
        anchorDetails: [],
        symmetryRatio: 1,
        reasons: [],
        error: undefined,
    };

    if (anchors.length === 0) return details;

    const patchSize = 50;
    const complexities: number[] = [];

    // 1. Establish Baselines (Noise & Body)
    try {
        // A. Triplet Noise (Sky/Background)
        const pL = await manipulateAsync(imageUri, [{ crop: { originX: 20, originY: 20, width: 50, height: 50 } }], { base64: true, format: SaveFormat.JPEG });
        const pC = await manipulateAsync(imageUri, [{ crop: { originX: Math.floor(width / 2) - 25, originY: 20, width: 50, height: 50 } }], { base64: true, format: SaveFormat.JPEG });
        const pR = await manipulateAsync(imageUri, [{ crop: { originX: width - 70, originY: 20, width: 50, height: 50 } }], { base64: true, format: SaveFormat.JPEG });

        // B. Body Complexity (Center of car panel)
        const pB = await manipulateAsync(imageUri, [{ crop: { originX: Math.floor(width / 2) - 25, originY: Math.floor(height / 2) - 25, width: 50, height: 50 } }], { base64: true, format: SaveFormat.JPEG });

        const nL = pL.base64?.length ?? 200;
        const nC = pC.base64?.length ?? 200;
        const nR = pR.base64?.length ?? 200;
        details.sceneNoise = (nL + nC + nR) / 3;
        details.bodyNoise = pB.base64?.length ?? 200;

        if (!pL.base64 || !pB.base64) details.error = 'NO_BASE64';
    } catch (e: any) {
        details.sceneNoise = 400;
        details.bodyNoise = 400;
        details.error = `BASE_ERR: ${e.message}`;
    }

    // 2. Sample Anchors
    const profile: Record<string, number> = {
        light: 800,
        wheel: 1000,
        mirror: 600,
        edge: 500,
    };

    for (const anchor of anchors) {
        const cx = Math.floor(anchor.x * width);
        const cy = Math.floor(anchor.y * height);
        const originX = Math.max(0, Math.min(width - patchSize, cx - patchSize / 2));
        const originY = Math.max(0, Math.min(height - patchSize, cy - patchSize / 2));
        try {
            const patch = await manipulateAsync(
                imageUri,
                [{ crop: { originX, originY, width: patchSize, height: patchSize } }],
                { base64: true, format: SaveFormat.JPEG }
            );
            complexities.push(patch.base64?.length ?? 0);
        } catch (e: any) {
            complexities.push(0);
            if (!details.error) details.error = `CROP_ERR: ${e.message}`;
        }
    }

    // 3. Calculated Symmetry Baseline
    if (complexities.length >= 2) {
        const c1 = complexities[0] || 1;
        const c2 = complexities[1] || 1;
        details.symmetryRatio = Math.min(c1, c2) / Math.max(c1, c2);
    }

    // 4. Robust Scoring
    let totalScore = 0;
    for (let i = 0; i < complexities.length; i++) {
        const c = complexities[i];
        const type = anchors[i]?.type || 'edge';
        const threshold = profile[type] ?? 800;

        const ratioNoise = c / (details.sceneNoise || 1);

        // Anchor patch just needs to be more detailed than the scene background.
        // reqRatio of 1.2 is lenient: gentle lighting, darker cars, etc. still pass.
        const reqRatio = 1.2;

        // Absolute floor: patch must have at least 30% of the feature-type threshold.
        const absMinimum = threshold * 0.30;

        const pass = (c > absMinimum) && (ratioNoise >= reqRatio);

        details.anchorDetails.push({ complexity: c, threshold, ratio: ratioNoise, reqRatio, pass });

        if (pass) {
            totalScore += Math.min(1, c / threshold);
        } else {
            if (c <= absMinimum) details.reasons.push(`[LOW_DETAIL_${i}]`);
            else if (ratioNoise < reqRatio) details.reasons.push(`[LOW_BG_RATIO_${i}]`);
        }
    }

    let finalScore = totalScore / (anchors.length || 1);

    // Asymmetry penalty: anchors look nothing alike → framing is off-centre
    if (details.symmetryRatio < 0.6) {
        finalScore *= details.symmetryRatio;
        details.reasons.push('[ASYMMETRIC]');
    }

    // Extreme scene noise penalty (busy background)
    if (details.sceneNoise > 4500 && details.symmetryRatio < 0.75) {
        finalScore *= 0.55;
        details.reasons.push('[EXTREME_TEXTURE]');
    }

    details.score = Math.min(1, finalScore);
    return details;
}
