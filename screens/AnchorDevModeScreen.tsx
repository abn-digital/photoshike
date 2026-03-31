/**
 * ─────────────────────────────────────────────────────────
 *  ANCHOR DEV MODE  –  TEMPORARY / ONE-TIME USE
 *  Live camera feed background. Drag each labelled anchor
 *  dot over the real car feature visible through the lens,
 *  then Submit All to export the updated JSON.
 * ─────────────────────────────────────────────────────────
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, PanResponder,
    TouchableOpacity, ScrollView, Share,
    Dimensions, SafeAreaView, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CAR_TEMPLATES, AnchorPoint, TemplateSVG } from '../components/CarSVGs';
import { RootStackParamList } from '../App';
import { Colors, Radii, Typography } from '../constants/theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'AnchorDevMode'> };

const { width: SW, height: SH } = Dimensions.get('window');

/** Size of the draggable dot touch target */
const DOT = 48;

/* ─────────────────────── types ────────────────────── */
type AnchorMap = { [templateId: string]: AnchorPoint[] };

function buildInitialMap(): AnchorMap {
    const map: AnchorMap = {};
    for (const tmpl of CAR_TEMPLATES) {
        map[tmpl.id] = tmpl.anchors.map(a => ({ ...a }));
    }
    return map;
}

const TYPE_COLOR: Record<string, string> = {
    wheel:    '#F59E0B',
    light:    '#60A5FA',
    mirror:   '#A78BFA',
    steering: '#34D399',
    headrest: '#FB7185',
    edge:     '#94A3B8',
    vent:     '#FDA4AF',
    gauge:    '#FDE68A',
    exhaust:  '#D1D5DB',
    interior: '#6EE7B7',
};

/* ══════════════════════════════════════════ SCREEN ════ */
export default function AnchorDevModeScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();

    const [anchorMap, setAnchorMap] = useState<AnchorMap>(buildInitialMap);
    const [tmplIdx, setTmplIdx] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const [exportJson, setExportJson] = useState('');
    const [svgVisible, setSvgVisible] = useState(true);
    const [infoVisible, setInfoVisible] = useState(true);

    // Viewport dimensions — we measure the full-screen camera area
    const [vpLayout, setVpLayout] = useState<{ width: number; height: number } | null>(null);

    const template = CAR_TEMPLATES[tmplIdx];
    const currentAnchors = anchorMap[template.id];

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission().then(r => {
                if (!r.granted) Alert.alert('Camera needed', 'Grant camera access to use the anchor editor.');
            });
        }
    }, []);

    const goNext = () => setTmplIdx(i => Math.min(i + 1, CAR_TEMPLATES.length - 1));
    const goPrev = () => setTmplIdx(i => Math.max(i - 1, 0));

    const updateAnchor = useCallback((templateId: string, anchorId: string, x: number, y: number) => {
        setAnchorMap(prev => ({
            ...prev,
            [templateId]: prev[templateId].map(a =>
                a.id === anchorId
                    ? { ...a, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
                    : a
            ),
        }));
    }, []);

    const handleSubmit = async () => {
        const output: Record<string, { id: string; label: string; x: number; y: number; type: string }[]> = {};
        for (const [id, anchors] of Object.entries(anchorMap)) {
            output[id] = anchors.map(a => ({
                id: a.id,
                label: a.label,
                x: parseFloat(a.x.toFixed(4)),
                y: parseFloat(a.y.toFixed(4)),
                type: a.type,
            }));
        }
        const json = JSON.stringify(output, null, 2);
        setExportJson(json);
        setSubmitted(true);
        console.log('\n════ ANCHOR DEV MODE EXPORT ════\n' + json + '\n════════════════════════════════\n');
        try {
            await Share.share({ message: json, title: 'Anchor Export' });
        } catch (_) { /* user cancelled — JSON still on screen */ }
    };

    const handleReset = () => {
        setAnchorMap(buildInitialMap());
        setSubmitted(false);
        setExportJson('');
        setTmplIdx(0);
    };

    if (submitted) {
        return <ExportView json={exportJson} onShare={handleSubmit} onReset={handleReset} onBack={() => navigation.goBack()} insets={insets} />;
    }

    // The SVG ghost is a square of svgSize centred in the screen.
    // Anchor fractions (0-1) are in SVG-square space, NOT raw screen space.
    const vpW = vpLayout?.width ?? SW;
    const vpH = vpLayout?.height ?? SH;
    const svgSize = Math.min(vpW, vpH);
    // Pixel offset of the SVG square's top-left corner within the screen
    const svgOffX = (vpW - svgSize) / 2;
    const svgOffY = (vpH - svgSize) / 2;

    return (
        <View style={styles.root}>
            {/* ── Full-screen camera ── */}
            <View
                style={StyleSheet.absoluteFill}
                onLayout={e => setVpLayout({
                    width: e.nativeEvent.layout.width,
                    height: e.nativeEvent.layout.height,
                })}
            >
                {permission?.granted ? (
                    <CameraView style={StyleSheet.absoluteFill} facing="back" />
                ) : (
                    <View style={styles.noCam}>
                        <MaterialCommunityIcons name="camera-off" size={48} color={Colors.textMuted} />
                        <Text style={styles.noCamText}>Camera permission required</Text>
                        <TouchableOpacity style={styles.permBtn} onPress={() => requestPermission()}>
                            <Text style={styles.permBtnText}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* ── SVG template ghost overlay ── */}
            {svgVisible && vpLayout && (
                <View style={styles.svgOverlay} pointerEvents="none">
                    <TemplateSVG
                        templateId={template.id}
                        size={svgSize}
                        opacity={0.35}
                        color="rgba(255,255,255,0.9)"
                    />
                </View>
            )}

            {/* ── Draggable anchors — full screen coordinate space ── */}
            {vpLayout && currentAnchors.map(anchor => (
                <DraggableAnchor
                    key={`${template.id}-${anchor.id}`}
                    anchor={anchor}
                    svgSize={svgSize}
                    svgOffX={svgOffX}
                    svgOffY={svgOffY}
                    vpWidth={vpLayout.width}
                    vpHeight={vpLayout.height}
                    onMove={(x, y) => updateAnchor(template.id, anchor.id, x, y)}
                />
            ))}

            {/* ── Top HUD bar ── */}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="close" size={18} color="#fff" />
                </TouchableOpacity>

                <View style={styles.topCenter}>
                    <View style={styles.devBadge}>
                        <MaterialCommunityIcons name="wrench" size={9} color="#FCD34D" />
                        <Text style={styles.devBadgeText}>ANCHOR EDITOR</Text>
                    </View>
                    <Text style={styles.topTemplateName} numberOfLines={1}>{template.name}</Text>
                </View>

                <View style={styles.counterBadge}>
                    <Text style={styles.counterText}>{tmplIdx + 1}/{CAR_TEMPLATES.length}</Text>
                </View>
            </View>

            {/* ── Toggle: SVG overlay / legend ── */}
            <View style={[styles.sideTools, { top: insets.top + 72 }]}>
                <TouchableOpacity
                    style={[styles.toolBtn, svgVisible && styles.toolBtnActive]}
                    onPress={() => setSvgVisible(v => !v)}
                >
                    <MaterialCommunityIcons name="vector-square" size={18} color={svgVisible ? '#fff' : Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toolBtn, infoVisible && styles.toolBtnActive]}
                    onPress={() => setInfoVisible(v => !v)}
                >
                    <MaterialCommunityIcons name="format-list-bulleted" size={18} color={infoVisible ? '#fff' : Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* ── Bottom controls ── */}
            <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 8 }]}>

                {/* Anchor legend — live coords */}
                {infoVisible && (
                    <View style={styles.legend}>
                        {currentAnchors.map(anchor => (
                            <View key={anchor.id} style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: TYPE_COLOR[anchor.type] ?? '#888' }]} />
                                <Text style={styles.legendLabel}>{anchor.label}</Text>
                                <Text style={styles.legendType}>[{anchor.type}]</Text>
                                <Text style={styles.legendCoord}>
                                    {anchor.x.toFixed(3)}, {anchor.y.toFixed(3)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Navigation + submit row */}
                <View style={styles.navRow}>
                    <TouchableOpacity
                        style={[styles.navBtn, tmplIdx === 0 && styles.navBtnDisabled]}
                        onPress={goPrev}
                        disabled={tmplIdx === 0}
                    >
                        <MaterialCommunityIcons name="chevron-left" size={20} color={tmplIdx === 0 ? Colors.textMuted : '#fff'} />
                        <Text style={[styles.navBtnText, tmplIdx === 0 && { color: Colors.textMuted }]}>Prev</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                        <MaterialCommunityIcons name="export" size={16} color="#fff" />
                        <Text style={styles.submitBtnText}>Submit All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navBtn, tmplIdx === CAR_TEMPLATES.length - 1 && styles.navBtnDisabled]}
                        onPress={goNext}
                        disabled={tmplIdx === CAR_TEMPLATES.length - 1}
                    >
                        <Text style={[styles.navBtnText, tmplIdx === CAR_TEMPLATES.length - 1 && { color: Colors.textMuted }]}>Next</Text>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={tmplIdx === CAR_TEMPLATES.length - 1 ? Colors.textMuted : '#fff'} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

/* ══════════════════════════ DRAGGABLE ANCHOR ══════════════ */
interface DraggableAnchorProps {
    anchor: AnchorPoint;
    /** Side length of the centered SVG square in screen pixels */
    svgSize: number;
    /** Horizontal pixel offset of the SVG square's left edge from screen left */
    svgOffX: number;
    /** Vertical pixel offset of the SVG square's top edge from screen top */
    svgOffY: number;
    vpWidth: number;
    vpHeight: number;
    onMove: (x: number, y: number) => void;
}

function DraggableAnchor({ anchor, svgSize, svgOffX, svgOffY, vpWidth, vpHeight, onMove }: DraggableAnchorProps) {
    // Convert anchor fraction → screen pixel, accounting for SVG centering
    const initX = svgOffX + anchor.x * svgSize;
    const initY = svgOffY + anchor.y * svgSize;

    const pixelPos = useRef({ x: initX, y: initY });
    const [displayPos, setDisplayPos] = useState({ x: initX, y: initY });
    const dotColor = TYPE_COLOR[anchor.type] ?? '#888';

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gs) => {
                const nx = Math.max(0, Math.min(vpWidth,  pixelPos.current.x + gs.dx));
                const ny = Math.max(0, Math.min(vpHeight, pixelPos.current.y + gs.dy));
                setDisplayPos({ x: nx, y: ny });
            },
            onPanResponderRelease: (_, gs) => {
                const nx = Math.max(0, Math.min(vpWidth,  pixelPos.current.x + gs.dx));
                const ny = Math.max(0, Math.min(vpHeight, pixelPos.current.y + gs.dy));
                pixelPos.current = { x: nx, y: ny };
                setDisplayPos({ x: nx, y: ny });
                // Convert screen pixels back to SVG-square fractions for export
                onMove(
                    Math.max(0, Math.min(1, (nx - svgOffX) / svgSize)),
                    Math.max(0, Math.min(1, (ny - svgOffY) / svgSize))
                );
            },
        })
    ).current;

    return (
        <View
            {...panResponder.panHandlers}
            style={[
                styles.anchor,
                {
                    left: displayPos.x - DOT / 2,
                    top:  displayPos.y - DOT / 2,
                    borderColor: dotColor,
                },
            ]}
        >
            <View style={[styles.crossH, { backgroundColor: dotColor }]} />
            <View style={[styles.crossV, { backgroundColor: dotColor }]} />
            <View style={[styles.anchorCenter, { backgroundColor: dotColor }]} />
            {/* Label bubble below the dot */}
            <View style={[styles.labelBubble, { backgroundColor: dotColor + 'E6' }]}>
                <Text style={styles.labelText} numberOfLines={2}>{anchor.label}</Text>
            </View>
        </View>
    );
}

/* ═══════════════════════════════════ EXPORT VIEW ══════════ */
function ExportView({ json, onShare, onReset, onBack, insets }: {
    json: string; onShare: () => void; onReset: () => void; onBack: () => void;
    insets: { top: number; bottom: number };
}) {
    return (
        <SafeAreaView style={styles.exportRoot}>
            {/* Header */}
            <View style={[styles.topBar, styles.exportHeader, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.topBtn} onPress={onBack}>
                    <MaterialCommunityIcons name="close" size={18} color="#fff" />
                </TouchableOpacity>
                <View style={styles.topCenter}>
                    <View style={[styles.devBadge, { backgroundColor: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.35)' }]}>
                        <MaterialCommunityIcons name="check-circle" size={9} color="#4ADE80" />
                        <Text style={[styles.devBadgeText, { color: '#4ADE80' }]}>EXPORTED</Text>
                    </View>
                    <Text style={styles.topTemplateName}>Anchor Export</Text>
                </View>
                <View style={{ width: 36 }} />
            </View>

            {/* Info strip */}
            <View style={styles.exportInfoRow}>
                <MaterialCommunityIcons name="information-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.exportInfoText}>
                    JSON logged to Expo console. Use Share to send it.
                </Text>
            </View>

            {/* JSON display */}
            <ScrollView style={styles.jsonScroll} contentContainerStyle={{ padding: 12 }}>
                <Text style={styles.jsonText} selectable>{json}</Text>
            </ScrollView>

            {/* Actions */}
            <View style={[styles.exportActions, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
                    <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />
                    <Text style={styles.shareBtnText}>Share / Copy JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
                    <MaterialCommunityIcons name="refresh" size={15} color={Colors.textSecondary} />
                    <Text style={styles.resetBtnText}>Start Over</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

/* ════════════════════════════════════════════ STYLES ═══════ */
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    exportRoot: { flex: 1, backgroundColor: '#0A0D12' },

    /* No-camera fallback */
    noCam: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0A0D12' },
    noCamText: { color: Colors.textMuted, fontSize: Typography.sm },
    permBtn: { backgroundColor: Colors.primarySubtle, borderWidth: 1, borderColor: 'rgba(43,140,238,0.3)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radii.full },
    permBtnText: { color: Colors.primary, fontWeight: '600', fontSize: Typography.sm },

    /* SVG ghost */
    svgOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },

    /* Top HUD */
    topBar: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 14, paddingBottom: 10,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    exportHeader: { position: 'relative', backgroundColor: '#111620', borderBottomWidth: 1, borderBottomColor: '#1E2533' },
    topBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    topCenter: { alignItems: 'center', gap: 3, flex: 1 },
    devBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(252,211,77,0.15)', borderWidth: 1,
        borderColor: 'rgba(252,211,77,0.35)', paddingHorizontal: 7,
        paddingVertical: 2, borderRadius: Radii.full,
    },
    devBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, color: '#FCD34D' },
    topTemplateName: { fontSize: Typography.sm, fontWeight: '700', color: '#fff' },
    counterBadge: {
        backgroundColor: 'rgba(43,140,238,0.2)', borderWidth: 1,
        borderColor: 'rgba(43,140,238,0.4)', paddingHorizontal: 10,
        paddingVertical: 4, borderRadius: Radii.full,
    },
    counterText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

    /* Side toggle tools */
    sideTools: { position: 'absolute', right: 14, zIndex: 20, gap: 10 },
    toolBtn: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    },
    toolBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

    /* Draggable anchor */
    anchor: {
        position: 'absolute', width: DOT, height: DOT,
        borderRadius: DOT / 2, borderWidth: 2.5,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 30,
    },
    crossH: { position: 'absolute', width: DOT - 6, height: 1.5, borderRadius: 1 },
    crossV: { position: 'absolute', width: 1.5, height: DOT - 6, borderRadius: 1 },
    anchorCenter: { width: 8, height: 8, borderRadius: 4 },
    labelBubble: {
        position: 'absolute', top: DOT + 4, alignSelf: 'center',
        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
        minWidth: 68, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 2,
    },
    labelText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3, textAlign: 'center' },

    /* Bottom sheet */
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        backgroundColor: 'rgba(0,0,0,0.72)',
        paddingHorizontal: 14, paddingTop: 10,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    },

    /* Legend */
    legend: { marginBottom: 10, gap: 5 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
    legendLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: '#fff' },
    legendType: { fontSize: 9, color: Colors.textMuted, marginRight: 4 },
    legendCoord: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontVariant: ['tabular-nums'] },

    /* Nav row */
    navRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    navBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 2,
        paddingHorizontal: 14, paddingVertical: 11,
        backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radii.md,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', minWidth: 76,
    },
    navBtnDisabled: { opacity: 0.35 },
    navBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    submitBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 7, backgroundColor: '#EF4444',
        paddingVertical: 12, borderRadius: Radii.md,
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5, shadowRadius: 6, elevation: 5,
    },
    submitBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },

    /* Export view */
    exportInfoRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 8,
        backgroundColor: '#111620', borderBottomWidth: 1, borderBottomColor: '#1E2533',
    },
    exportInfoText: { flex: 1, fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
    jsonScroll: { flex: 1, margin: 12, backgroundColor: '#0A0D12', borderRadius: 8, borderWidth: 1, borderColor: '#1E2533' },
    jsonText: { fontSize: 10, color: '#4ADE80', fontFamily: 'monospace', lineHeight: 16 },
    exportActions: { paddingHorizontal: 16, gap: 8 },
    shareBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: Colors.primary,
        paddingVertical: 14, borderRadius: Radii.md,
    },
    shareBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
    resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
    resetBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
});
