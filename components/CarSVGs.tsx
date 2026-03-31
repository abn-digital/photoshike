import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { Colors } from '../constants/theme';

const STROKE = Colors.white;

export interface AnchorPoint {
    id: string;
    label: string;
    x: number;
    y: number;
    type: 'light' | 'wheel' | 'mirror' | 'edge' | 'vent' | 'gauge' | 'steering' | 'exhaust' | 'interior' | 'headrest';
}

export const CAR_TEMPLATES = [
    {
        id: 'car-side',
        name: 'Side Profile',
        ratio: '16:9',
        category: 'Exterior' as const,
        anchors: [
            { id: 's-front-wheel', label: 'Front Wheel', x: 0.26, y: 0.715, type: 'wheel' },
            { id: 's-rear-wheel', label: 'Rear Wheel', x: 0.75, y: 0.715, type: 'wheel' },
        ] as AnchorPoint[],
    },
    {
        id: 'car-front',
        name: 'Front View',
        ratio: '4:3',
        category: 'Exterior' as const,
        anchors: [
            { id: 'f-left-headlight', label: 'Left Headlight', x: 0.25, y: 0.46, type: 'light' },
            { id: 'f-right-headlight', label: 'Right Headlight', x: 0.75, y: 0.46, type: 'light' },
        ] as AnchorPoint[],
    },
    {
        id: 'car-rear',
        name: 'Rear View',
        ratio: '4:3',
        category: 'Exterior' as const,
        anchors: [
            { id: 'r-left-taillight', label: 'Left Taillight', x: 0.25, y: 0.50, type: 'light' },
            { id: 'r-right-taillight', label: 'Right Taillight', x: 0.75, y: 0.50, type: 'light' },
        ] as AnchorPoint[],
    },
    {
        id: 'car-diagonal-left',
        name: 'Diagonal 3/4 Left',
        ratio: '4:3',
        category: 'Exterior' as const,
        anchors: [
            // Mirrored from car-diagonal-right (2026-03-30): x = 1 − x_right, y unchanged
            { id: 'dl-front-wheel', label: 'Front Wheel', x: 0.5899, y: 0.6935, type: 'wheel' },
            { id: 'dl-rear-wheel',  label: 'Rear Wheel',  x: 0.8121, y: 0.5078, type: 'wheel' },
            { id: 'dl-headlight',   label: 'Headlight',   x: 0.4216, y: 0.6048, type: 'light' },
        ] as AnchorPoint[],
    },
    {
        id: 'car-diagonal-right',
        name: 'Diagonal 3/4 Right',
        ratio: '4:3',
        category: 'Exterior' as const,
        anchors: [
            // Calibrated 2026-03-30 via AnchorDevModeScreen live session (master for diagonal pair)
            { id: 'dr-front-wheel', label: 'Front Wheel', x: 0.4101, y: 0.6935, type: 'wheel' },
            { id: 'dr-rear-wheel',  label: 'Rear Wheel',  x: 0.1879, y: 0.5078, type: 'wheel' },
            { id: 'dr-headlight',   label: 'Headlight',   x: 0.5784, y: 0.6048, type: 'light' },
        ] as AnchorPoint[],
    },
    // ── Interior ────────────────────────────────────────────────
    {
        id: 'interior-front-left',
        name: 'Front Interior Left',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            // Calibrated 2026-03-30 via AnchorDevModeScreen live session
            { id: 'ifl-steering', label: 'Steering Wheel', x: 0.3593, y: 0.6096, type: 'steering' },
            { id: 'ifl-mirror',   label: 'Rear-View Mirror', x: 0.5663, y: 0.3036, type: 'mirror' },
        ] as AnchorPoint[],
    },
    {
        id: 'interior-front-center',
        name: 'Front Interior Center',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            // Calibrated 2026-03-30 via AnchorDevModeScreen live session
            { id: 'ifc-steering', label: 'Steering Wheel', x: 0.2684, y: 0.5486, type: 'steering' },
            { id: 'ifc-mirror',   label: 'Rear-View Mirror', x: 0.5005, y: 0.3284, type: 'mirror' },
        ] as AnchorPoint[],
    },
    {
        id: 'interior-front-right',
        name: 'Front Interior Right',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            // Calibrated 2026-03-30 via AnchorDevModeScreen live session
            { id: 'ifr-steering', label: 'Steering Wheel', x: 0.3766, y: 0.4933, type: 'steering' },
            { id: 'ifr-mirror',   label: 'Rear-View Mirror', x: 0.4855, y: 0.3286, type: 'mirror' },
        ] as AnchorPoint[],
    },
    {
        id: 'interior-rear-left',
        name: 'Rear Interior Left',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            // Calibrated 2026-03-30 via AnchorDevModeScreen live session
            { id: 'irl-headrest-l', label: 'Left Headrest',  x: 0.3000, y: 0.3800, type: 'headrest' },
            { id: 'irl-headrest-r', label: 'Right Headrest', x: 0.6774, y: 0.4250, type: 'headrest' },
        ] as AnchorPoint[],
    },
    {
        id: 'interior-rear-right',
        name: 'Rear Interior Right',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            // Calibrated 2026-03-30 via AnchorDevModeScreen live session
            { id: 'irr-headrest-l', label: 'Left Headrest',  x: 0.3535, y: 0.4436, type: 'headrest' },
            { id: 'irr-headrest-r', label: 'Right Headrest', x: 0.6491, y: 0.4218, type: 'headrest' },
        ] as AnchorPoint[],
    },
];

/** 
 * Get alignment anchors for a template, adjusted by granular scales and offset.
 * wheelbaseScale: horizontal spacing for 'wheel' anchors.
 * featureWidthScale: horizontal spacing for everything else.
 * verticalOffset: global vertical nudge.
 */
export function getAnchorsForTemplate(
    templateId: string, 
    wheelbaseScale: number = 1.0, 
    featureWidthScale: number = 1.0, 
    verticalOffset: number = 0.0
): AnchorPoint[] {
    const tmpl = CAR_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return [];

    return tmpl.anchors.map(a => {
        if (a.type === 'steering' || a.type === 'mirror') {
            // Scale vertically from 0.5 (frame centre) so mirror moves up
            // and steering wheel moves down as featureWidthScale increases.
            const dy = a.y - 0.5;
            return { ...a, y: 0.5 + dy * featureWidthScale + verticalOffset };
        }
        if (a.type === 'light' && (templateId === 'car-diagonal-left' || templateId === 'car-diagonal-right')) {
            // Headlight tracks the front wheel — scale with wheelbaseScale, not featureWidthScale.
            const dx = a.x - 0.5;
            return { ...a, x: 0.5 + dx * wheelbaseScale, y: a.y + verticalOffset };
        }
        const dx = a.x - 0.5;
        const s = a.type === 'wheel' ? wheelbaseScale : featureWidthScale;
        return {
            ...a,
            x: 0.5 + dx * s,
            y: a.y + verticalOffset
        };
    });
}

interface SvgProps { 
    size?: number; 
    opacity?: number; 
    color?: string; 
    wheelbaseScale?: number; 
    featureWidthScale?: number; 
    verticalOffset?: number 
}

export function SideProfileSVG({ 
    size = 200, opacity = 1, color, 
    wheelbaseScale = 1.0, verticalOffset = 0.0 
}: SvgProps) {
    const s = color ?? STROKE;
    const centerX = 100;
    const fDist = 100 - 52;
    const rDist = 150 - 100;
    
    const fx = centerX - fDist * wheelbaseScale;
    const rx = centerX + rDist * wheelbaseScale;
    const yOff = verticalOffset * 200; // viewport units

    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            <Path 
                d={`M15 110 Q18 95 28 90 L60 80 Q80 60 100 56 Q118 52 138 56 L162 68 Q175 78 180 100`} 
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} 
                transform={`translate(0, ${yOff})`}
            />
            <Circle cx={fx} cy={143 + yOff} r="18" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            <Circle cx={rx} cy={143 + yOff} r="18" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
        </Svg>
    );
}

export function FrontViewSVG({ 
    size = 200, opacity = 1, color, 
    featureWidthScale = 1.0, verticalOffset = 0.0 
}: SvgProps) {
    const s = color ?? STROKE;
    const centerX = 100;
    const dist = 50 * featureWidthScale;
    const yOff = verticalOffset * 200;

    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            <Path d="M40 140 L40 100 Q42 80 60 70 L80 60 Q100 58 120 60 L140 70 Q158 80 160 100 L160 140" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} transform={`translate(0, ${yOff})`} />
            <Rect x={centerX - dist - 15} y={85 + yOff} width="30" height="15" rx="4" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            <Rect x={centerX + dist - 15} y={85 + yOff} width="30" height="15" rx="4" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
        </Svg>
    );
}

export function RearViewSVG({ 
    size = 200, opacity = 1, color, 
    featureWidthScale = 1.0, verticalOffset = 0.0 
}: SvgProps) {
    const s = color ?? STROKE;
    const centerX = 100;
    const dist = 50 * featureWidthScale;
    const yOff = verticalOffset * 200;

    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            <Path d="M40 140 L40 100 Q42 80 60 70 L80 60 Q100 58 120 60 L140 70 Q158 80 160 100 L160 140" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} transform={`translate(0, ${yOff})`} />
            <Rect x={centerX - dist - 18} y={90 + yOff} width="36" height="12" rx="3" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            <Rect x={centerX + dist - 18} y={90 + yOff} width="36" height="12" rx="3" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
        </Svg>
    );
}

export function DiagonalSVG({ 
    size = 200, opacity = 1, color, 
    wheelbaseScale = 1.0, verticalOffset = 0.0 
}: SvgProps) {
    const s = color ?? STROKE;
    // Calibrated 2026-03-30 (mirrored from diagonal-right master).
    // Wheel pair mid: x=140, y=120. Near wheel lower-left of mid, far wheel upper-right.
    const midX = 140;
    const midY = 120;
    const hSpan = 22 * wheelbaseScale;
    const vSpan = 19 * wheelbaseScale;
    const fWheelX = midX - hSpan;   // at scale=1: 118
    const fWheelY = midY + vSpan;   // at scale=1: 139
    const rWheelX = midX + hSpan;   // at scale=1: 162
    const rWheelY = midY - vSpan;   // at scale=1: 101
    // Headlight is left of front wheel (front faces left)
    const lightX  = fWheelX - 34;   // at scale=1: 84
    const lightY  = fWheelY - 18;   // at scale=1: 121 centre → rect top ~114
    const yOff = verticalOffset * 200;

    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            {/* body — front left, rear upper-right */}
            <Path d="M18 152 L18 118 Q24 88 55 74 Q85 62 130 64 Q158 66 174 84 L180 112 Q180 138 168 152"
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} transform={`translate(0, ${yOff})`} />
            {/* near front wheel — larger */}
            <Circle cx={fWheelX} cy={fWheelY + yOff} r="16" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            {/* far rear wheel — smaller, higher */}
            <Circle cx={rWheelX} cy={rWheelY + yOff} r="12" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.85} />
            {/* headlight */}
            <Rect x={lightX - 15} y={lightY - 7 + yOff} width="30" height="15" rx="4" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity} />
        </Svg>
    );
}

/** Horizontally mirrored diagonal — front faces right (right-3/4 shot). */
export function DiagonalFlippedSVG({ 
    size = 200, opacity = 1, color, 
    wheelbaseScale = 1.0, verticalOffset = 0.0 
}: SvgProps) {
    const s = color ?? STROKE;
    // Calibrated 2026-03-30 (live session master for diagonal pair).
    // Wheel pair mid: x=60, y=120. Near wheel lower-right of mid, far wheel upper-left.
    const midX = 60;
    const midY = 120;
    const hSpan = 22 * wheelbaseScale;
    const vSpan = 19 * wheelbaseScale;
    const fWheelX = midX + hSpan;   // at scale=1: 82
    const fWheelY = midY + vSpan;   // at scale=1: 139
    const rWheelX = midX - hSpan;   // at scale=1: 38
    const rWheelY = midY - vSpan;   // at scale=1: 101
    // Headlight is right of front wheel (front faces right)
    const lightX  = fWheelX + 34;   // at scale=1: 116
    const lightY  = fWheelY - 18;   // at scale=1: 121 centre → rect top ~114
    const yOff = verticalOffset * 200;

    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            {/* body — mirror of DiagonalSVG: front right, rear upper-left */}
            <Path d="M182 152 L182 118 Q176 88 145 74 Q115 62 70 64 Q42 66 26 84 L20 112 Q20 138 32 152"
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} transform={`translate(0, ${yOff})`} />
            {/* near front wheel — larger */}
            <Circle cx={fWheelX} cy={fWheelY + yOff} r="16" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            {/* far rear wheel — smaller, higher */}
            <Circle cx={rWheelX} cy={rWheelY + yOff} r="12" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.85} />
            {/* headlight */}
            <Rect x={lightX - 15} y={lightY - 7 + yOff} width="30" height="15" rx="4" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity} />
        </Svg>
    );
}

// ── Interior SVGs ────────────────────────────────────────────────────────────

/**
 * Shared interior schematic helper — draws a dash/windshield silhouette,
 * a steering wheel and a rear-view mirror. `featureWidthScale` pushes them
 * apart (>1) or together (<1) from their base positions.
 */
function InteriorFrontSVG({
    size = 200, opacity = 1, color, verticalOffset = 0.0,
    featureWidthScale = 1.0,
    steerBase = 70, mirrorBase = 104,
    steerYBase = 152, mirrorYBase = 72,
}: SvgProps & { steerBase?: number; mirrorBase?: number; steerYBase?: number; mirrorYBase?: number }) {
    const s = color ?? STROKE;
    const yOff = verticalOffset * 200;
    // Scale mirror and steering vertically from their midpoint.
    // Scale > 1 pushes them apart; scale < 1 brings them together.
    const midY = (mirrorYBase + steerYBase) / 2;
    const mirrorY = midY + (mirrorYBase - midY) * featureWidthScale + yOff;
    const steerY  = midY + (steerYBase  - midY) * featureWidthScale + yOff;
    const steerX  = steerBase;
    const mirrorX = mirrorBase;
    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            {/* windshield / dash silhouette */}
            <Path d="M20 160 L20 120 Q25 90 50 75 L90 62 Q100 60 110 62 L150 75 Q175 90 180 120 L180 160"
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.55} transform={`translate(0, ${yOff})`} />
            {/* dashboard line */}
            <Line x1="22" y1={140 + yOff} x2="178" y2={140 + yOff} stroke={s} strokeWidth="2" opacity={opacity * 0.45} />
            {/* rear-view mirror */}
            <Rect x={mirrorX - 14} y={mirrorY} width="28" height="10" rx="3"
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity} />
            {/* steering wheel ring */}
            <Circle cx={steerX} cy={steerY} r="18" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity} />
            {/* steering wheel cross */}
            <Line x1={steerX - 18} y1={steerY} x2={steerX + 18} y2={steerY} stroke={s} strokeWidth="1.5" opacity={opacity * 0.6} />
            <Line x1={steerX} y1={steerY - 18} x2={steerX} y2={steerY + 18} stroke={s} strokeWidth="1.5" opacity={opacity * 0.6} />
        </Svg>
    );
}

export function InteriorFrontLeftSVG(props: SvgProps) {
    // Calibrated 2026-03-30: steer (72, 122), mirror (113, 61)
    return <InteriorFrontSVG {...props} steerBase={72} mirrorBase={113} steerYBase={122} mirrorYBase={61} />;
}

export function InteriorFrontCenterSVG(props: SvgProps) {
    // Calibrated 2026-03-30: steer (54, 110), mirror (100, 66)
    return <InteriorFrontSVG {...props} steerBase={54} mirrorBase={100} steerYBase={110} mirrorYBase={66} />;
}

export function InteriorFrontRightSVG(props: SvgProps) {
    // Calibrated 2026-03-30: steer (75, 99), mirror (97, 66)
    return <InteriorFrontSVG {...props} steerBase={75} mirrorBase={97} steerYBase={99} mirrorYBase={66} />;
}

/** Rear interior view — two front-seat headrests visible, offset for left/right angle. */
export function InteriorRearLeftSVG({ size = 200, opacity = 1, color, verticalOffset = 0.0 }: SvgProps) {
    const s = color ?? STROKE;
    const yOff = verticalOffset * 200;
    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            {/* rear windshield / roof line */}
            <Path d="M30 90 Q32 70 60 60 L100 56 L140 60 Q168 70 170 90"
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.45} transform={`translate(0, ${yOff})`} />
            {/* left seat back (closer, larger) */}
            <Rect x={28} y={100 + yOff} width={64} height={55} rx={8}
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} />
            {/* left headrest — calibrated 2026-03-30: centre (60, 76) */}
            <Rect x={44} y={65 + yOff} width={32} height={22} rx={6}
                stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            {/* right seat back (farther, smaller) */}
            <Rect x={108} y={100 + yOff} width={58} height={48} rx={8}
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.55} />
            {/* right headrest — calibrated 2026-03-30: centre (136, 85) */}
            <Rect x={122} y={75 + yOff} width={28} height={20} rx={6}
                stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
        </Svg>
    );
}

export function InteriorRearRightSVG({ size = 200, opacity = 1, color, verticalOffset = 0.0 }: SvgProps) {
    const s = color ?? STROKE;
    const yOff = verticalOffset * 200;
    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            {/* rear windshield / roof line */}
            <Path d="M30 90 Q32 70 60 60 L100 56 L140 60 Q168 70 170 90"
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.45} transform={`translate(0, ${yOff})`} />
            {/* left seat back (farther, smaller) */}
            <Rect x={30} y={108 + yOff} width={58} height={48} rx={8}
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.55} />
            {/* left headrest — calibrated 2026-03-30: centre (71, 89) */}
            <Rect x={57} y={79 + yOff} width={28} height={20} rx={6}
                stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            {/* right seat back (closer, larger) */}
            <Rect x={100} y={100 + yOff} width={64} height={55} rx={8}
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} />
            {/* right headrest — calibrated 2026-03-30: centre (130, 84) */}
            <Rect x={114} y={73 + yOff} width={32} height={22} rx={6}
                stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
        </Svg>
    );
}

export function TemplateSVG({ 
    templateId, size = 140, opacity = 1, color, 
    wheelbaseScale = 1.0, featureWidthScale = 1.0, verticalOffset = 0.0 
}: { 
    templateId: string; size?: number; opacity?: number; color?: string; 
    wheelbaseScale?: number; featureWidthScale?: number; verticalOffset?: number 
}) {
    switch (templateId) {
        case 'car-side':              return <SideProfileSVG size={size} opacity={opacity} color={color} wheelbaseScale={wheelbaseScale} verticalOffset={verticalOffset} />;
        case 'car-front':             return <FrontViewSVG size={size} opacity={opacity} color={color} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'car-rear':              return <RearViewSVG size={size} opacity={opacity} color={color} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'car-diagonal-left':     return <DiagonalSVG size={size} opacity={opacity} color={color} wheelbaseScale={wheelbaseScale} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'car-diagonal-right':    return <DiagonalFlippedSVG size={size} opacity={opacity} color={color} wheelbaseScale={wheelbaseScale} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'interior-front-left':   return <InteriorFrontLeftSVG size={size} opacity={opacity} color={color} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'interior-front-center': return <InteriorFrontCenterSVG size={size} opacity={opacity} color={color} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'interior-front-right':  return <InteriorFrontRightSVG size={size} opacity={opacity} color={color} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'interior-rear-left':    return <InteriorRearLeftSVG size={size} opacity={opacity} color={color} verticalOffset={verticalOffset} />;
        case 'interior-rear-right':   return <InteriorRearRightSVG size={size} opacity={opacity} color={color} verticalOffset={verticalOffset} />;
        default: return <View />;
    }
}
