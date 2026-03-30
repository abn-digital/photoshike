import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radii, Typography } from '../constants/theme';

/* ── Alignment state type ── */
export type AlignState = 'idle' | 'ready' | 'scanning' | 'approved' | 'rejected';

/* ── State → Color mapping ── */
export function stateColor(state: AlignState): string {
    switch (state) {
        case 'ready': return '#EAB308';
        case 'scanning': return '#3B82F6';
        case 'approved': return '#22C55E';
        case 'rejected': return '#EF4444';
        default: return 'rgba(255,255,255,0.7)';
    }
}

/* ─── Fixed Reference Marker ─────────────────────────────── */
export function ReferenceMarker({ label, x, y, state }: {
    label: string; x: number; y: number; state: AlignState;
}) {
    const color = stateColor(state);

    return (
        <View
            style={[
                styles.refMarker,
                {
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    borderColor: color,
                    backgroundColor: state === 'approved'
                        ? 'rgba(34,197,94,0.15)'
                        : state === 'rejected'
                            ? 'rgba(239,68,68,0.15)'
                            : state === 'ready'
                                ? 'rgba(234,179,8,0.15)'
                                : 'rgba(255,255,255,0.06)',
                },
            ]}
            pointerEvents="none"
        >
            <View style={[styles.refCross, { backgroundColor: color }]} />
            <View style={[styles.refCrossV, { backgroundColor: color }]} />
            <Text style={[styles.refLabel, { color }]} numberOfLines={1}>{label}</Text>
        </View>
    );
}

/* ─── Level Indicator ───────────────────────────────────────── */
export function LevelIndicator({ roll, isLevel }: { roll: number; isLevel: boolean }) {
    const barColor = isLevel ? '#EAB308' : Colors.danger;
    const clampedRoll = Math.max(-15, Math.min(15, roll));
    const dotOffset = (clampedRoll / 15) * 45;

    return (
        <View style={styles.levelWrap}>
            <View style={styles.levelBar}>
                <View style={styles.levelCenter} />
                <View style={[
                    styles.levelDot,
                    { backgroundColor: barColor, transform: [{ translateX: dotOffset }] },
                ]} />
            </View>
            <Text style={[styles.levelText, { color: barColor }]}>
                {isLevel ? 'LEVEL ✓' : `${roll.toFixed(1)}°`}
            </Text>
        </View>
    );
}

/* ─── Analyzing Pill ────────────────────────────────────── */
export function AnalyzingPill() {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
            ])
        ).start();
        return () => { pulse.stopAnimation(); };
    }, []);

    return (
        <View style={styles.analyzingOverlay} pointerEvents="none">
            <Animated.View style={[styles.analyzingPill, { opacity: pulse }]}>
                <View style={styles.analyzingDot} />
                <Text style={styles.analyzingText}>ANALYZING · KEEP STILL</Text>
            </Animated.View>
        </View>
    );
}

/* ─── Status Badge ───────────────────────────────────────── */
export function StatusBadge({ state, score, hint }: { state: AlignState; score: number; hint?: string }) {
    const color = stateColor(state);
    const pct = Math.round(score * 100);

    const configs: Record<AlignState, { icon: string; text: string }> = {
        idle: { icon: 'phone-rotate-landscape', text: 'LEVEL YOUR PHONE' },
        ready: { icon: 'camera', text: 'HOLD STEADY…' },
        scanning: { icon: 'magnify-scan', text: 'SCANNING…' },
        approved: { icon: 'check-circle', text: `ALIGNED ${pct}% · READY` },
        rejected: { icon: 'close-circle', text: 'MISALIGNED · RETAKE' },
    };

    const { icon, text } = configs[state];

    return (
        <View style={[
            styles.statusBadge,
            { backgroundColor: `${color}18`, borderColor: `${color}55` },
        ]}>
            <MaterialCommunityIcons name={icon as any} size={14} color={color} />
            <View>
                <Text style={[styles.statusBadgeText, { color }]}>{text}</Text>
                {hint ? (
                    <Text style={[styles.statusBadgeHint, { color }]}>{hint}</Text>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    refMarker: {
        position: 'absolute', width: 32, height: 32,
        marginLeft: -16, marginTop: -16, borderRadius: 16,
        borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', zIndex: 12,
    },
    refCross: { position: 'absolute', width: 14, height: 1.5, borderRadius: 1 },
    refCrossV: { position: 'absolute', width: 1.5, height: 14, borderRadius: 1 },
    refLabel: {
        position: 'absolute', top: 36, fontSize: 9, fontWeight: '700',
        backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, borderRadius: 2,
    },
    levelWrap: {
        position: 'absolute', top: 10, alignSelf: 'center',
        alignItems: 'center', zIndex: 15,
    },
    levelBar: {
        width: 100, height: 6, borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    levelCenter: {
        position: 'absolute', width: 2, height: 10,
        backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1,
    },
    levelDot: { width: 10, height: 10, borderRadius: 5 },
    levelText: { fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 3 },
    statusBadge: {
        position: 'absolute', bottom: 14, alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: Radii.full, borderWidth: 1, zIndex: 15,
    },
    statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    statusBadgeHint: { fontSize: 9, fontWeight: '500', letterSpacing: 0.3, opacity: 0.85, marginTop: 1 },
    analyzingOverlay: {
        position: 'absolute', inset: 0,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 20,
    },
    analyzingPill: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(15,20,30,0.82)',
        borderWidth: 1, borderColor: 'rgba(59,130,246,0.55)',
        paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: Radii.full,
        shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
    },
    analyzingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
    analyzingText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#93C5FD' },
});
