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
            { id: 'dl-front-wheel', label: 'Front Wheel', x: 0.255, y: 0.69, type: 'wheel' },
            { id: 'dl-rear-wheel', label: 'Rear Wheel', x: 0.745, y: 0.69, type: 'wheel' },
            // x=0.355 = (frontWheelCx+20)/200 at scale=1; tracks front wheel horizontally
            { id: 'dl-headlight', label: 'Headlight', x: 0.355, y: 0.49, type: 'light' },
        ] as AnchorPoint[],
    },
    {
        id: 'car-diagonal-right',
        name: 'Diagonal 3/4 Right',
        ratio: '4:3',
        category: 'Exterior' as const,
        anchors: [
            { id: 'dr-front-wheel', label: 'Front Wheel', x: 0.745, y: 0.69, type: 'wheel' },
            { id: 'dr-rear-wheel', label: 'Rear Wheel', x: 0.255, y: 0.69, type: 'wheel' },
            // x=0.645 = (frontWheelCx-20)/200 at scale=1; tracks front wheel horizontally
            { id: 'dr-headlight', label: 'Headlight', x: 0.645, y: 0.49, type: 'light' },
        ] as AnchorPoint[],
    },
    // ── Interior ────────────────────────────────────────────────
    {
        id: 'interior-front-left',
        name: 'Front Interior Left',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            { id: 'ifl-steering', label: 'Steering Wheel', x: 0.35, y: 0.58, type: 'steering' },
            { id: 'ifl-mirror', label: 'Rear-View Mirror', x: 0.52, y: 0.28, type: 'mirror' },
        ] as AnchorPoint[],
    },
    {
        id: 'interior-front-center',
        name: 'Front Interior Center',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            { id: 'ifc-steering', label: 'Steering Wheel', x: 0.36, y: 0.60, type: 'steering' },
            { id: 'ifc-mirror', label: 'Rear-View Mirror', x: 0.50, y: 0.27, type: 'mirror' },
        ] as AnchorPoint[],
    },
    {
        id: 'interior-front-right',
        name: 'Front Interior Right',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            { id: 'ifr-steering', label: 'Steering Wheel', x: 0.65, y: 0.58, type: 'steering' },
            { id: 'ifr-mirror', label: 'Rear-View Mirror', x: 0.48, y: 0.28, type: 'mirror' },
        ] as AnchorPoint[],
    },
    {
        id: 'interior-rear-left',
        name: 'Rear Interior Left',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            { id: 'irl-headrest-l', label: 'Left Headrest', x: 0.30, y: 0.38, type: 'headrest' },
            { id: 'irl-headrest-r', label: 'Right Headrest', x: 0.62, y: 0.35, type: 'headrest' },
        ] as AnchorPoint[],
    },
    {
        id: 'interior-rear-right',
        name: 'Rear Interior Right',
        ratio: '4:3',
        category: 'Interior' as const,
        anchors: [
            { id: 'irr-headrest-l', label: 'Left Headrest', x: 0.38, y: 0.35, type: 'headrest' },
            { id: 'irr-headrest-r', label: 'Right Headrest', x: 0.70, y: 0.38, type: 'headrest' },
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
    wheelbaseScale = 1.0, featureWidthScale = 1.0, verticalOffset = 0.0 
}: SvgProps) {
    const s = color ?? STROKE;
    const centerX = 100;
    const fWheelDist = 49 * wheelbaseScale; 
    const rWheelDist = 49 * wheelbaseScale;
    // Headlight sits just right of the front (left) wheel, tracks with wheelbaseScale.
    // lightX center = frontWheelCx + 20 → at scale=1: 51+20=71 → anchor x=0.355
    const lightX = (centerX - fWheelDist) + 20;
    const yOff = verticalOffset * 200;

    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            <Path d="M30 130 L30 105 Q32 85 55 72 L80 58 Q100 52 145 56 Q162 62 178 105 L178 130" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} transform={`translate(0, ${yOff})`} />
            <Circle cx={centerX - fWheelDist} cy={138 + yOff} r="16" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            <Circle cx={centerX + rWheelDist} cy={138 + yOff} r="12" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.85} />
            <Rect x={lightX - 15} y={90 + yOff} width="30" height="15" rx="4" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity} />
        </Svg>
    );
}

/** Horizontally mirrored diagonal — front faces right (right-3/4 shot). */
export function DiagonalFlippedSVG({ 
    size = 200, opacity = 1, color, 
    wheelbaseScale = 1.0, featureWidthScale = 1.0, verticalOffset = 0.0 
}: SvgProps) {
    const s = color ?? STROKE;
    const centerX = 100;
    const fWheelDist = 49 * wheelbaseScale;
    const rWheelDist = 49 * wheelbaseScale;
    // Headlight sits just left of the front (right) wheel, tracks with wheelbaseScale.
    // lightX center = frontWheelCx - 20 → at scale=1: 149-20=129 → anchor x=0.645
    const lightX = (centerX + fWheelDist) - 20;
    const yOff = verticalOffset * 200;

    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            {/* body path — mirrored horizontally around x=100 */}
            <Path d="M170 130 L170 105 Q168 85 145 72 L120 58 Q100 52 55 56 Q38 62 22 105 L22 130" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} transform={`translate(0, ${yOff})`} />
            <Circle cx={centerX + fWheelDist} cy={138 + yOff} r="16" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            <Circle cx={centerX - rWheelDist} cy={138 + yOff} r="12" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.85} />
            <Rect x={lightX - 15} y={90 + yOff} width="30" height="15" rx="4" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity} />
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
    // Camera left: steering right of mid-frame, mirror left of mid-frame.
    return <InteriorFrontSVG {...props} steerBase={70} mirrorBase={104} />;
}

export function InteriorFrontCenterSVG(props: SvgProps) {
    // Camera centred: steering left of centre, mirror centred.
    return <InteriorFrontSVG {...props} steerBase={75} mirrorBase={100} />;
}

export function InteriorFrontRightSVG(props: SvgProps) {
    // Camera right: steering further left, mirror right of mid-frame.
    return <InteriorFrontSVG {...props} steerBase={130} mirrorBase={96} />;
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
            {/* left headrest */}
            <Rect x={44} y={80 + yOff} width={32} height={22} rx={6}
                stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            {/* right seat back (farther, smaller) */}
            <Rect x={108} y={108 + yOff} width={58} height={48} rx={8}
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.55} />
            {/* right headrest */}
            <Rect x={122} y={90 + yOff} width={28} height={20} rx={6}
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
            {/* left headrest */}
            <Rect x={44} y={90 + yOff} width={28} height={20} rx={6}
                stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            {/* right seat back (closer, larger) */}
            <Rect x={108} y={100 + yOff} width={64} height={55} rx={8}
                stroke={s} strokeWidth="2.5" fill="none" opacity={opacity * 0.6} />
            {/* right headrest */}
            <Rect x={122} y={80 + yOff} width={32} height={22} rx={6}
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
