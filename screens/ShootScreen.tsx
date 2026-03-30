import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Alert, Platform, Animated,
} from 'react-native';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Svg, { Line } from 'react-native-svg';

import { Colors, Radii, Typography } from '../constants/theme';
import { useAppState } from '../context/AppContext';
import { TemplateSVG, getAnchorsForTemplate } from '../components/CarSVGs';
import { RootStackParamList } from '../App';
import { useDeviceLevel } from '../hooks/useDeviceLevel';
import { DragSlider } from '../components/DragSlider';
import {
    AlignState, stateColor,
    ReferenceMarker, LevelIndicator, AnalyzingPill, StatusBadge,
} from '../components/CameraOverlays';
import { analyzeAlignmentByCrops } from '../utils/alignmentAnalysis';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SW } = Dimensions.get('window');

/* ═══ Main Screen ═══════════════════════════════════════════ */
export default function ShootScreen() {
    const navigation = useNavigation<Nav>();
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [facing] = useState<CameraType>('back');
    const [isCapturing, setIsCapturing] = useState(false);
    const [alignState, setAlignState] = useState<AlignState>('idle');
    const [alignScore, setAlignScore] = useState(0);
    const [rejectionHint, setRejectionHint] = useState<string | undefined>(undefined);
    const [cameraFlash, setCameraFlash] = useState<FlashMode>('off');
    const levelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        selectedTemplate, overlayOpacity, setOverlayOpacity,
        overlayLocked, setOverlayLocked,
        gridVisible, setGridVisible,
        guidesVisible, setGuidesVisible,
        setCapturedPhotoUri,
        wheelbaseScale, setWheelbaseScale,
        featureWidthScale, setFeatureWidthScale,
        verticalOffset, setVerticalOffset,
    } = useAppState();

    const { roll, isLevel } = useDeviceLevel();

    // Measure the camera viewport so we can convert SVG-space anchor coords
    // (0-1 of the 200×200 SVG square) into viewport-space fractions (0-1 of
    // the actual View). The SVG is rendered at SW*0.75 and centered, so
    // without this conversion markers are placed in completely the wrong spot.
    const SVG_RENDER_SIZE = SW * 0.75; // must match size={SW * 0.75} on TemplateSVG
    const [vpLayout, setVpLayout] = useState<{ width: number; height: number } | null>(null);

    /** Convert one anchor from SVG-square space → viewport fraction space. */
    const toVpAnchor = useCallback(
        (a: { x: number; y: number }) => {
            if (!vpLayout) return a;
            const offX = (vpLayout.width - SVG_RENDER_SIZE) / 2;
            const offY = (vpLayout.height - SVG_RENDER_SIZE) / 2;
            return {
                x: (offX + a.x * SVG_RENDER_SIZE) / vpLayout.width,
                y: (offY + a.y * SVG_RENDER_SIZE) / vpLayout.height,
            };
        },
        [vpLayout, SVG_RENDER_SIZE]
    );

    // Raw SVG-space anchors (used to drive the SVG overlay).
    const anchors = selectedTemplate
        ? getAnchorsForTemplate(selectedTemplate.id, wheelbaseScale, featureWidthScale, verticalOffset)
        : [];

    // Viewport-space anchors: correctly placed on screen and used for the
    // alignment image analysis (camera frame ≈ viewport).
    const vpAnchors = anchors.map(a => ({ ...a, ...toVpAnchor(a) }));

    // Request camera permission
    const requestCameraIfNeeded = useCallback(async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Permission', 'Camera access is needed.');
            }
        }
    }, [permission]);

    useEffect(() => { requestCameraIfNeeded(); }, []);

    /* ── Automatic alignment flow ──
       Level detected → wait 1.5s → auto-capture snapshot → analyze → green/red
    */
    useEffect(() => {
        if (!selectedTemplate) return;

        // Skip if we're already scanning or showing a result
        if (alignState === 'scanning' || alignState === 'approved' || alignState === 'rejected') return;

        if (isLevel) {
            if (alignState === 'idle') setAlignState('ready');
        } else {
            if (alignState === 'ready') setAlignState('idle');
        }
    }, [isLevel, selectedTemplate, alignState]);

    // Cleanup timers
    useEffect(() => {
        return () => {
            if (levelTimerRef.current) clearTimeout(levelTimerRef.current);
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        };
    }, []);

    /* ── Unified capture: check alignment then shoot ── */

    /** Translate raw reason codes into one actionable user-facing hint. */
    function reasonToHint(reasons: string[]): string {
        if (reasons.includes('[ASYMMETRIC]')) return 'Center the car in frame';
        if (reasons.includes('[EXTREME_TEXTURE]')) return 'Background too busy — find a cleaner spot';
        if (reasons.some(r => r.startsWith('[LOW_DETAIL_'))) return 'Car feature not visible — get closer';
        if (reasons.some(r => r.startsWith('[LOW_BG_RATIO_'))) return 'Background too similar to car';
        if (reasons.some(r => r.startsWith('[LOW_BODY_RATIO_'))) return 'Car features unclear — try better lighting';
        return 'Reposition and try again';
    }

    const handleCapture = async () => {
        if (!cameraRef.current || isCapturing || alignState === 'scanning') return;
        setIsCapturing(true);
        setRejectionHint(undefined);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // No template → just shoot directly, no alignment needed
            if (!selectedTemplate) {
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
                if (!photo?.uri) {
                    Alert.alert('Camera Error', 'Failed to capture photo. Please try again.');
                    return;
                }
                setCapturedPhotoUri(photo.uri);
                navigation.navigate('Validate');
                return;
            }

            // 1. Run alignment check on a fast low-quality snapshot
            //    Force flash OFF so the white screen doesn't confuse/startle the user
            setCameraFlash('off');
            setAlignState('scanning');

            const snap = await cameraRef.current.takePictureAsync({ quality: 0.3 });
            if (!snap?.uri) {
                setRejectionHint('Camera not ready — try again');
                setAlignState('rejected');
                resetTimerRef.current = setTimeout(() => { setAlignState('idle'); }, 3000);
                return;
            }

            // Crop snapshot to 4:5
            const sensorRatio = snap.width / snap.height;
            const targetRatio = 0.8;
            let crop = { originX: 0, originY: 0, width: snap.width, height: snap.height };
            if (sensorRatio > targetRatio) {
                const tw = snap.height * targetRatio;
                crop.originX = (snap.width - tw) / 2;
                crop.width = tw;
            } else {
                const th = snap.width / targetRatio;
                crop.originY = (snap.height - th) / 2;
                crop.height = th;
            }
            const resized = await manipulateAsync(snap.uri, [{ crop }, { resize: { width: 400 } }], { format: SaveFormat.JPEG });

            const result = await analyzeAlignmentByCrops(resized.uri, resized.width, resized.height, vpAnchors);
            setAlignScore(result.score);

            console.log('─── ALIGNMENT CHECK ───');
            console.log(`Score: ${Math.round(result.score * 100)}%`);
            console.log(`Scene Noise: ${Math.round(result.sceneNoise)}`);
            console.log(`Body Noise: ${Math.round(result.bodyNoise)}`);
            console.log(`Symmetry: ${Math.round(result.symmetryRatio * 100)}%`);
            result.anchorDetails.forEach((a, i) => {
                console.log(`Anchor ${i}: C=${a.complexity}, R=${a.ratio.toFixed(2)} (Req=${a.reqRatio}) - ${a.pass ? 'PASS' : 'FAIL'}`);
            });
            if (result.reasons.length > 0) console.log(`Reasons: ${result.reasons.join(', ')}`);
            if (result.error) console.log(`Error: ${result.error}`);
            console.log('──────────────────────');

            if (result.score > 0.80) {
                // 2a. Passed → take HQ photo immediately and navigate
                setAlignState('approved');
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Restore flash to auto for the real shot
                setCameraFlash('auto');
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
                setCameraFlash('off');
                if (!photo?.uri) {
                    Alert.alert('Camera Error', 'Alignment passed but photo capture failed. Please try again.');
                    setAlignState('idle');
                    return;
                }
                setCapturedPhotoUri(photo.uri);
                navigation.navigate('Validate');
            } else {
                // 2b. Failed → red badge with hint, reset after 4s
                const hint = reasonToHint(result.reasons);
                setRejectionHint(hint);
                setAlignState('rejected');
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                resetTimerRef.current = setTimeout(() => {
                    resetTimerRef.current = null;
                    setRejectionHint(undefined);
                    setAlignState('idle');
                }, 4000);
            }
        } catch (e: any) {
            console.warn('Capture error:', e);
            setAlignState('idle');
            Alert.alert(
                'Camera Error',
                'Something went wrong while taking the photo. Make sure the camera is ready and try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsCapturing(false);
        }
    };

    // Visual colors
    const overlayColor = stateColor(alignState);
    const isScanning = alignState === 'scanning';

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 42 }} />
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Camera Feed</Text>
                    <Text style={styles.headerSub}>4:5 ASPECT RATIO</Text>
                </View>
                <View style={{ width: 42 }} />
            </View>

            {/* Camera Viewport */}
            <View
                style={styles.viewport}
                onLayout={(e) => setVpLayout({
                    width: e.nativeEvent.layout.width,
                    height: e.nativeEvent.layout.height,
                })}
            >
                {permission?.granted ? (
                    <CameraView
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        facing={facing}
                        flash={cameraFlash}
                        animateShutter={false}
                    />
                ) : (
                    <View style={styles.noCameraWrap}>
                        <MaterialCommunityIcons name="camera-off" size={56} color={Colors.textMuted} />
                        <Text style={styles.noCameraText}>Camera permission required</Text>
                        <TouchableOpacity style={styles.permBtn} onPress={requestCameraIfNeeded}>
                            <Text style={styles.permBtnText}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Onion skin overlay */}
                {selectedTemplate && (
                    <View style={[styles.overlayWrap, { opacity: overlayOpacity }]} pointerEvents="none">
                        <TemplateSVG
                            templateId={selectedTemplate.id}
                            size={SW * 0.75}
                            color={overlayColor}
                            wheelbaseScale={wheelbaseScale}
                            featureWidthScale={featureWidthScale}
                            verticalOffset={verticalOffset}
                        />
                    </View>
                )}

                {/* Fixed reference markers — positioned in viewport space */}
                {selectedTemplate && guidesVisible && vpAnchors.length > 0 && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        {vpAnchors.map((anchor) => (
                            <ReferenceMarker
                                key={anchor.id}
                                label={anchor.label}
                                x={anchor.x}
                                y={anchor.y}
                                state={alignState}
                            />
                        ))}
                    </View>
                )}

                {/* Grid overlay */}
                {gridVisible && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <Line x1="33.3" y1="0" x2="33.3" y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
                            <Line x1="66.6" y1="0" x2="66.6" y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
                            <Line x1="0" y1="33.3" x2="100" y2="33.3" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
                            <Line x1="0" y1="66.6" x2="100" y2="66.6" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
                        </Svg>
                    </View>
                )}

                {/* Level indicator */}
                <LevelIndicator roll={roll} isLevel={isLevel} />

                {/* Analyzing pill — shown while scanning */}
                {alignState === 'scanning' && <AnalyzingPill />}

                {/* Status badge — shown on idle (level prompt) and rejected (hint) */}
                {selectedTemplate && (alignState === 'idle' || alignState === 'rejected') && (
                    <StatusBadge state={alignState} score={alignScore} hint={rejectionHint} />
                )}

                {/* Side controls */}
                <View style={styles.sideControls}>
                    <TouchableOpacity
                        style={[styles.sideBtn, gridVisible && styles.sideBtnActive]}
                        onPress={() => setGridVisible(!gridVisible)}
                    >
                        <MaterialCommunityIcons name="grid" size={20} color={gridVisible ? '#fff' : Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sideBtn, guidesVisible && styles.sideBtnActiveGreen]}
                        onPress={() => setGuidesVisible(!guidesVisible)}
                    >
                        <MaterialCommunityIcons name="crosshairs" size={20} color={guidesVisible ? '#fff' : Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sideBtn, overlayLocked && styles.sideBtnActive]}
                        onPress={() => setOverlayLocked(!overlayLocked)}
                    >
                        <MaterialCommunityIcons name={overlayLocked ? 'lock' : 'lock-open-outline'} size={20} color={overlayLocked ? '#fff' : Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Choose template hint */}
                {!selectedTemplate && (
                    <TouchableOpacity
                        style={styles.tmplHint}
                        onPress={() => navigation.navigate('Templates')}
                    >
                        <MaterialCommunityIcons name="layers-plus" size={16} color={Colors.primary} />
                        <Text style={styles.tmplHintText}>Choose Overlay Template</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Bottom Controls */}
            <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 8 }]}>
                {/* Opacity Slider */}
                <View style={[styles.sliderSection, !selectedTemplate && styles.dimmed, { marginBottom: 12 }]}>
                    <View style={styles.sliderHeader}>
                        <View style={styles.sliderLabelRow}>
                            <MaterialCommunityIcons name="layers" size={14} color={Colors.primary} />
                            <Text style={styles.sliderLabel}>ONION SKIN</Text>
                        </View>
                        <View style={styles.sliderValueBadge}>
                            <Text style={styles.sliderValueText}>{Math.round(overlayOpacity * 100)}%</Text>
                        </View>
                    </View>
                    <DragSlider
                        value={overlayOpacity} min={0} max={1}
                        disabled={overlayLocked}
                        onValueChange={setOverlayOpacity}
                    />
                </View>

                {/* Granular Alignment Sliders */}
                {selectedTemplate && (
                    <View style={styles.alignmentSliders}>
                        {/* Wheelbase (if applicable) */}
                        {(selectedTemplate.id === 'car-side' || selectedTemplate.id === 'car-diagonal-left' || selectedTemplate.id === 'car-diagonal-right') && (
                            <View style={styles.sliderSection}>
                                <View style={styles.sliderHeader}>
                                    <View style={styles.sliderLabelRow}>
                                        <MaterialCommunityIcons name="axis-arrow" size={14} color={Colors.primary} />
                                        <Text style={styles.sliderLabel}>WHEELBASE</Text>
                                    </View>
                                    <View style={styles.sliderValueBadge}>
                                        <Text style={styles.sliderValueText}>{Math.round(wheelbaseScale * 100)}%</Text>
                                    </View>
                                </View>
                                <DragSlider
                                    value={wheelbaseScale} min={0.5} max={1.5}
                                    disabled={overlayLocked}
                                    onValueChange={setWheelbaseScale}
                                />
                            </View>
                        )}

                        {/* Feature spacing — mirror ↔ steering wheel (interior front only) */}
                        {(selectedTemplate.id === 'interior-front-left' || selectedTemplate.id === 'interior-front-center' || selectedTemplate.id === 'interior-front-right') && (
                            <View style={styles.sliderSection}>
                                <View style={styles.sliderHeader}>
                                    <View style={styles.sliderLabelRow}>
                                        <MaterialCommunityIcons name="arrow-up-down" size={14} color={Colors.primary} />
                                        <Text style={styles.sliderLabel}>MIRROR TO WHEEL DIST</Text>
                                    </View>
                                    <View style={styles.sliderValueBadge}>
                                        <Text style={styles.sliderValueText}>{Math.round(featureWidthScale * 100)}%</Text>
                                    </View>
                                </View>
                                <DragSlider
                                    value={featureWidthScale} min={0.5} max={1.5}
                                    disabled={overlayLocked}
                                    onValueChange={setFeatureWidthScale}
                                />
                            </View>
                        )}

                        {/* Vertical Offset */}
                        <View style={styles.sliderSection}>
                            <View style={styles.sliderHeader}>
                                <View style={styles.sliderLabelRow}>
                                    <MaterialCommunityIcons name="arrow-up-down" size={14} color={Colors.primary} />
                                    <Text style={styles.sliderLabel}>VERTICAL OFFSET</Text>
                                </View>
                                <View style={styles.sliderValueBadge}>
                                    <Text style={styles.sliderValueText}>{Math.round(verticalOffset * 100)}%</Text>
                                </View>
                            </View>
                            <DragSlider
                                value={verticalOffset} min={-0.1} max={0.1}
                                disabled={overlayLocked}
                                fillColor={Colors.warning}
                                thumbColor={Colors.warning}
                                onValueChange={setVerticalOffset}
                            />
                        </View>
                    </View>
                )}

                {/* Shutter row */}
                <View style={styles.shutterRow}>
                    <TouchableOpacity
                        style={styles.galleryThumb}
                        onPress={() => navigation.navigate('Main' as any)}
                    >
                        <MaterialCommunityIcons name="image-outline" size={22} color={Colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.shutterWrap}
                        onPress={handleCapture}
                        activeOpacity={0.85}
                        disabled={isCapturing || isScanning || !selectedTemplate}
                    >
                        <View style={[
                            styles.shutterOuter,
                            isScanning && { borderColor: 'rgba(59,130,246,0.6)', borderWidth: 3 },
                            alignState === 'ready' && { borderColor: 'rgba(234,179,8,0.5)' },
                            alignState === 'rejected' && { borderColor: 'rgba(239,68,68,0.5)' },
                        ]} />
                        <View style={[
                            styles.shutterInner,
                            isCapturing && { backgroundColor: Colors.primary },
                            isScanning && { backgroundColor: '#3B82F6' },
                            alignState === 'ready' && { backgroundColor: '#EAB308' },
                            alignState === 'rejected' && { backgroundColor: '#EF4444' },
                        ]} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.ratioBtn}
                        onPress={() => navigation.navigate('Templates')}
                    >
                        <View style={styles.ratioBtnIcon}>
                            <MaterialCommunityIcons name="aspect-ratio" size={22} color={Colors.textSecondary} />
                        </View>
                        <Text style={styles.ratioBtnText}>{selectedTemplate?.ratio ?? '4:5'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgDark },
    header: {
        height: 56, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 16,
        backgroundColor: Colors.bgSurface, borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
    headerSub: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1.5 },
    viewport: { flex: 1, backgroundColor: '#000', overflow: 'hidden', position: 'relative' },
    noCameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    noCameraText: { color: Colors.textMuted, fontSize: Typography.sm },
    permBtn: {
        backgroundColor: Colors.primarySubtle, borderWidth: 1,
        borderColor: 'rgba(43,140,238,0.3)', paddingHorizontal: 20,
        paddingVertical: 10, borderRadius: Radii.full,
    },
    permBtnText: { color: Colors.primary, fontWeight: '600', fontSize: Typography.sm },
    overlayWrap: {
        position: 'absolute', inset: 0, alignItems: 'center',
        justifyContent: 'center', zIndex: 3,
    },
    sideControls: { position: 'absolute', right: 14, top: '35%', gap: 12, zIndex: 10 },
    sideBtn: {
        width: 48, height: 48, borderRadius: Radii.full,
        backgroundColor: 'rgba(23,31,42,0.7)', borderWidth: 1,
        borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    },
    sideBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    sideBtnActiveGreen: { backgroundColor: Colors.success, borderColor: Colors.success },
    tmplHint: {
        position: 'absolute', bottom: 16, alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(43,140,238,0.15)', borderWidth: 1,
        borderColor: 'rgba(43,140,238,0.35)', paddingHorizontal: 18,
        paddingVertical: 8, borderRadius: Radii.full, zIndex: 10,
    },
    tmplHintText: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '700', letterSpacing: 0.5 },
    bottomControls: {
        backgroundColor: Colors.bgDark, paddingHorizontal: 20, paddingTop: 16,
        paddingBottom: 16, borderTopWidth: 1, borderTopColor: Colors.border,
    },
    alignmentSliders: { gap: 12, marginBottom: 16 },
    sliderSection: {},
    dimmed: { opacity: 0.4 },
    sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sliderLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sliderLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: Colors.textPrimary },
    sliderValueBadge: {
        backgroundColor: Colors.primarySubtle, borderWidth: 1,
        borderColor: 'rgba(43,140,238,0.25)', paddingHorizontal: 10,
        paddingVertical: 2, borderRadius: Radii.full, minWidth: 52, alignItems: 'center',
    },
    sliderValueText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.primary },
    shutterRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4,
    },
    galleryThumb: {
        width: 52, height: 52, borderRadius: Radii.md,
        backgroundColor: Colors.bgCard, borderWidth: 1.5,
        borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    },
    shutterWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
    shutterOuter: {
        position: 'absolute', width: 80, height: 80, borderRadius: 40,
        borderWidth: 2.5, borderColor: 'rgba(43,140,238,0.35)',
    },
    shutterInner: {
        width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff',
        borderWidth: 2, borderColor: 'rgba(0,0,0,0.1)',
    },
    ratioBtn: { alignItems: 'center', gap: 4 },
    ratioBtnIcon: {
        width: 52, height: 52, borderRadius: Radii.md,
        backgroundColor: Colors.bgCard, borderWidth: 1,
        borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    },
    ratioBtnText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
});
