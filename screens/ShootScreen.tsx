import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Alert, Platform, PanResponder, Animated,
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

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SW, height: SH } = Dimensions.get('window');

/* ── Alignment result state ── */
type AlignState = 'idle' | 'ready' | 'scanning' | 'approved' | 'rejected';

/* ── State → Color mapping ── */
function stateColor(state: AlignState): string {
    switch (state) {
        case 'ready': return '#EAB308';    // yellow
        case 'scanning': return '#3B82F6'; // blue
        case 'approved': return '#22C55E'; // green
        case 'rejected': return '#EF4444'; // red
        default: return 'rgba(255,255,255,0.7)'; // idle
    }
}

/* ─── Fixed Reference Marker ─────────────────────────────── */
function ReferenceMarker({ label, x, y, state }: {
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
function LevelIndicator({ roll, isLevel }: { roll: number; isLevel: boolean }) {
    const barColor = isLevel ? '#EAB308' : Colors.danger;
    const clampedRoll = Math.max(-15, Math.min(15, roll));
    const dotOffset = (clampedRoll / 15) * 45;

    return (
        <View style={styles.levelWrap}>
            <View style={styles.levelBar}>
                <View style={styles.levelCenter} />
                <View style={[
                    styles.levelDot,
                    {
                        backgroundColor: barColor,
                        transform: [{ translateX: dotOffset }],
                    },
                ]} />
            </View>
            <Text style={[styles.levelText, { color: barColor }]}>
                {isLevel ? 'LEVEL ✓' : `${roll.toFixed(1)}°`}
            </Text>
        </View>
    );
}

/* ─── Analyzing Pill ────────────────────────────────────── */
function AnalyzingPill() {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
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
function StatusBadge({ state, score, hint }: { state: AlignState; score: number; hint?: string }) {
    const color = stateColor(state);
    const pct = Math.round(score * 100);

    const configs: Record<AlignState, { icon: string; text: string }> = {
        idle:     { icon: 'phone-rotate-landscape', text: 'LEVEL YOUR PHONE' },
        ready:    { icon: 'camera',                 text: 'HOLD STEADY…' },
        scanning: { icon: 'magnify-scan',           text: 'SCANNING…' },
        approved: { icon: 'check-circle',           text: `ALIGNED ${pct}% · READY` },
        rejected: { icon: 'close-circle',           text: 'MISALIGNED · RETAKE' },
    };

    const { icon, text } = configs[state];

    return (
        <View style={[
            styles.statusBadge,
            {
                backgroundColor: `${color}18`,
                borderColor: `${color}55`,
            },
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

/* ─── Draggable Slider ───────────────────────────────────── */
function DragSlider({
    value, onValueChange, min, max, disabled, fillColor, thumbColor, trackWidth,
}: {
    value: number;
    onValueChange: (v: number) => void;
    min: number;
    max: number;
    disabled?: boolean;
    fillColor?: string;
    thumbColor?: string;
    trackWidth?: number;
}) {
    const tw = trackWidth ?? SW - 40;
    // When locked, fall back to a muted gray regardless of the intended color.
    const lockedColor = 'rgba(255,255,255,0.2)';
    const fColor = disabled ? lockedColor : (fillColor ?? Colors.primary);
    const tColor = disabled ? 'rgba(255,255,255,0.35)' : (thumbColor ?? Colors.primary);
    const range = max - min;

    // Keep refs to latest props so the PanResponder closure is never stale.
    const valueRef = useRef(value);
    const onValueChangeRef = useRef(onValueChange);
    const disabledRef = useRef(disabled);
    useEffect(() => { valueRef.current = value; }, [value]);
    useEffect(() => { onValueChangeRef.current = onValueChange; }, [onValueChange]);
    useEffect(() => { disabledRef.current = disabled; }, [disabled]);

    // Value at the moment the user touches down — delta is computed from here.
    const startValue = useRef(value);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            // On touch-down: just snapshot the current value. Do NOT jump to
            // locationX — locationX can be relative to a child view (fill/thumb)
            // and would cause the slider to snap to 0 or to the wrong position.
            onPanResponderGrant: () => {
                if (disabledRef.current) return;
                startValue.current = valueRef.current;
            },
            // On drag: compute new value from how far the finger has moved
            // relative to the touch-down point. gestureState.dx is always the
            // cumulative delta from the original touch, so it's rock-stable.
            onPanResponderMove: (_e, gestureState) => {
                if (disabledRef.current) return;
                const delta = (gestureState.dx / tw) * range;
                const raw = startValue.current + delta;
                onValueChangeRef.current(parseFloat(Math.max(min, Math.min(max, raw)).toFixed(2)));
            },
        })
    ).current;

    const pct = ((value - min) / range) * 100;

    return (
        <View style={styles.sliderTrack} {...panResponder.panHandlers}>
            <View style={[styles.sliderFill, { width: `${pct}%`, backgroundColor: fColor }]} />
            <View style={[styles.sliderThumb, { left: `${pct}%`, backgroundColor: tColor }]} />
        </View>
    );
}


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
            const offX = (vpLayout.width  - SVG_RENDER_SIZE) / 2;
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
            // Phone level → show ready state
            if (alignState === 'idle') {
                setAlignState('ready');
            }
        } else {
            // Phone not level → reset to idle
            if (alignState === 'ready') {
                setAlignState('idle');
            }
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
        if (reasons.includes('[ASYMMETRIC]'))        return 'Center the car in frame';
        if (reasons.includes('[EXTREME_TEXTURE]'))   return 'Background too busy — find a cleaner spot';
        if (reasons.some(r => r.startsWith('[LOW_DETAIL_')))   return 'Car feature not visible — get closer';
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

            console.log("─── ALIGNMENT CHECK ───");
            console.log(`Score: ${Math.round(result.score * 100)}%`);
            console.log(`Scene Noise: ${Math.round(result.sceneNoise)}`);
            console.log(`Body Noise: ${Math.round(result.bodyNoise)}`);
            console.log(`Symmetry: ${Math.round(result.symmetryRatio * 100)}%`);
            result.anchorDetails.forEach((a, i) => {
                console.log(`Anchor ${i}: C=${a.complexity}, R=${a.ratio.toFixed(2)} (Req=${a.reqRatio}) - ${a.pass ? 'PASS' : 'FAIL'}`);
            });
            if (result.reasons.length > 0) console.log(`Reasons: ${result.reasons.join(", ")}`);
            if (result.error) console.log(`Error: ${result.error}`);
            console.log("──────────────────────");

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
                    width:  e.nativeEvent.layout.width,
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
                    <View
                        style={[styles.overlayWrap, { opacity: overlayOpacity }]}
                        pointerEvents="none"
                    >
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

/* ── Crop-based alignment analysis ───────────────────────── */
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
async function analyzeAlignmentByCrops(
    imageUri: string,
    width: number,
    height: number,
    anchors: { x: number; y: number; type: string }[],
): Promise<{ 
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
}> {
    const details = {
        score: 0,
        sceneNoise: 0,
        bodyNoise: 0,
        anchorDetails: [] as any[],
        symmetryRatio: 1,
        reasons: [] as string[],
        error: undefined as string | undefined
    };

    if (anchors.length === 0) return details;

    const patchSize = 50;
    const complexities: number[] = [];

    // 1. Establish Baselines (Noise & Body)
    try {
        // A. Triplet Noise (Sky/Background)
        const pL = await manipulateAsync(imageUri, [{ crop: { originX: 20, originY: 20, width: 50, height: 50 } }], { base64: true, format: SaveFormat.JPEG });
        const pC = await manipulateAsync(imageUri, [{ crop: { originX: Math.floor(width/2)-25, originY: 20, width: 50, height: 50 } }], { base64: true, format: SaveFormat.JPEG });
        const pR = await manipulateAsync(imageUri, [{ crop: { originX: width - 70, originY: 20, width: 50, height: 50 } }], { base64: true, format: SaveFormat.JPEG });
        
        // B. Body Complexity (Center of car panel)
        const pB = await manipulateAsync(imageUri, [{ crop: { originX: Math.floor(width/2)-25, originY: Math.floor(height/2)-25, width: 50, height: 50 } }], { base64: true, format: SaveFormat.JPEG });

        const nL = pL.base64?.length ?? 200;
        const nC = pC.base64?.length ?? 200;
        const nR = pR.base64?.length ?? 200;
        details.sceneNoise = (nL + nC + nR) / 3;
        details.bodyNoise = pB.base64?.length ?? 200;

        if (!pL.base64 || !pB.base64) details.error = "NO_BASE64";
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

        details.anchorDetails.push({
            complexity: c,
            threshold,
            ratio: ratioNoise,
            reqRatio,
            pass
        });

        if (pass) {
            totalScore += Math.min(1, c / threshold);
        } else {
            if (c <= absMinimum)          details.reasons.push(`[LOW_DETAIL_${i}]`);
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
    headerBtn: { width: 42, alignItems: 'flex-end' },
    viewport: {
        flex: 1, backgroundColor: '#000', overflow: 'hidden', position: 'relative',
    },
    noCameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    noCameraText: { color: Colors.textMuted, fontSize: Typography.sm },
    permBtn: {
        backgroundColor: Colors.primarySubtle, borderWidth: 1,
        borderColor: 'rgba(43,140,238,0.3)', paddingHorizontal: 20,
        paddingVertical: 10, borderRadius: Radii.full,
    },
    permBtnText: { color: Colors.primary, fontWeight: '600', fontSize: Typography.sm },

    refLabel: {
        position: 'absolute', top: 36, fontSize: 9, fontWeight: '700',
        backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, borderRadius: 2,
    },
    scanBtn: {
        position: 'absolute', bottom: 30, alignSelf: 'center',
        backgroundColor: '#EAB308', flexDirection: 'row', alignItems: 'center',
        gap: 10, paddingHorizontal: 24, paddingVertical: 14,
        borderRadius: Radii.full, zIndex: 100, elevation: 5,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 4,
    },
    scanBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
    overlayWrap: {
        position: 'absolute', inset: 0, alignItems: 'center',
        justifyContent: 'center', zIndex: 3,
    },
    refMarker: {
        position: 'absolute', width: 32, height: 32,
        marginLeft: -16, marginTop: -16, borderRadius: 16,
        borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', zIndex: 12,
    },
    refCross: { position: 'absolute', width: 14, height: 1.5, borderRadius: 1 },
    refCrossV: { position: 'absolute', width: 1.5, height: 14, borderRadius: 1 },
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
    analyzingDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: '#3B82F6',
    },
    analyzingText: {
        fontSize: 12, fontWeight: '800', letterSpacing: 1.5,
        color: '#93C5FD',
    },

    sideControls: {
        position: 'absolute', right: 14, top: '35%', gap: 12, zIndex: 10,
    },
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
    sliderTrack: {
        height: 6, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: Radii.full, overflow: 'visible', position: 'relative',
        justifyContent: 'center'
    },
    sliderFill: {
        height: 6, backgroundColor: Colors.primary,
        borderRadius: Radii.full,
    },
    sliderThumb: {
        position: 'absolute', width: 20, height: 20,
        borderRadius: 10, backgroundColor: Colors.primary,
        marginLeft: -10, // Center the thumb over the actual value point
        elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3, shadowRadius: 2,
    },shutterRow: {
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
