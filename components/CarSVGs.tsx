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
    type: 'light' | 'wheel' | 'mirror' | 'edge' | 'vent' | 'gauge' | 'steering' | 'exhaust' | 'interior';
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
        id: 'car-diagonal',
        name: 'Diagonal 3/4',
        ratio: '4:3',
        category: 'Exterior' as const,
        anchors: [
            { id: 'd-front-wheel', label: 'Front Wheel', x: 0.255, y: 0.69, type: 'wheel' },
            { id: 'd-rear-wheel', label: 'Rear Wheel', x: 0.745, y: 0.69, type: 'wheel' },
            { id: 'd-headlight', label: 'Headlight', x: 0.47, y: 0.455, type: 'light' },
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
                stroke={s} strokeWidth="1" fill="none" opacity={opacity * 0.25} 
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
            <Path d="M40 140 L40 100 Q42 80 60 70 L80 60 Q100 58 120 60 L140 70 Q158 80 160 100 L160 140" stroke={s} strokeWidth="1" fill="none" opacity={opacity * 0.25} transform={`translate(0, ${yOff})`} />
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
            <Path d="M40 140 L40 100 Q42 80 60 70 L80 60 Q100 58 120 60 L140 70 Q158 80 160 100 L160 140" stroke={s} strokeWidth="1" fill="none" opacity={opacity * 0.25} transform={`translate(0, ${yOff})`} />
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
    const lightX = 100 + (147 - 100) * featureWidthScale;
    const yOff = verticalOffset * 200;

    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
            <Path d="M30 130 L30 105 Q32 85 55 72 L80 58 Q100 52 145 56 Q162 62 178 105 L178 130" stroke={s} strokeWidth="1" fill="none" opacity={opacity * 0.25} transform={`translate(0, ${yOff})`} />
            <Circle cx={centerX - fWheelDist} cy={138 + yOff} r="12" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            <Circle cx={centerX + rWheelDist} cy={138 + yOff} r="12" stroke={s} strokeWidth="3" fill="none" opacity={opacity} />
            <Rect x={lightX - 15} y={90 + yOff} width="30" height="15" rx="4" stroke={s} strokeWidth="2.5" fill="none" opacity={opacity} />
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
        case 'car-side': return <SideProfileSVG size={size} opacity={opacity} color={color} wheelbaseScale={wheelbaseScale} verticalOffset={verticalOffset} />;
        case 'car-front': return <FrontViewSVG size={size} opacity={opacity} color={color} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'car-rear': return <RearViewSVG size={size} opacity={opacity} color={color} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        case 'car-diagonal': return <DiagonalSVG size={size} opacity={opacity} color={color} wheelbaseScale={wheelbaseScale} featureWidthScale={featureWidthScale} verticalOffset={verticalOffset} />;
        default: return <View />;
    }
}
