import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Alert, Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
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

/* ─── Status Badge ───────────────────────────────────────── */
function StatusBadge({ state, score }: { state: AlignState; score: number }) {
    const color = stateColor(state);
    const pct = Math.round(score * 100);

    const configs: Record<AlignState, { icon: string; text: string }> = {
        idle: { icon: 'phone-rotate-landscape', text: 'LEVEL YOUR PHONE' },
        ready: { icon: 'camera', text: 'HOLD STEADY…' },
        scanning: { icon: 'magnify-scan', text: 'SCANNING…' },
        approved: { icon: 'check-circle', text: `ALIGNED ${pct}% · READY` },
        rejected: { icon: 'close-circle', text: `MISALIGNED ${pct}% · RETAKE` },
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
            <Text style={[styles.statusBadgeText, { color }]}>{text}</Text>
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
    const levelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        selectedTemplate, overlayOpacity, setOverlayOpacity,
        overlayLocked, setOverlayLocked,
        gridVisible, setGridVisible,
        guidesVisible, setGuidesVisible,
        setCapturedPhotoUri,
        wheelbaseScale, setWheelbaseScale,
        verticalOffset, setVerticalOffset,
    } = useAppState();

    const { roll, isLevel } = useDeviceLevel();

    const featureWidthScale = 1.0; // Constant feature width as requested

    const anchors = selectedTemplate 
        ? getAnchorsForTemplate(selectedTemplate.id, wheelbaseScale, featureWidthScale, verticalOffset) 
        : [];

    // 4:5 letterbox calculation
    const viewportWidth = SW;
    const idealHeight = viewportWidth * (5 / 4);
    const viewportHeight = SH - insets.top - insets.bottom - 72 - 180;
    const letterbarH = Math.max(0, (viewportHeight - Math.min(idealHeight, viewportHeight)) / 2);

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

    /* ── Run alignment check ── */
    const runAlignmentCheck = useCallback(async () => {
        if (!cameraRef.current || !selectedTemplate) return;

        setAlignState('scanning');

        try {
            // 1. Capture snapshot
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.3 });
            if (!photo?.uri) {
                setAlignState('idle');
                return;
            }

            // 2. Normalize and Crop to 4:5 aspect ratio
            // Sensor is usually 3:4 (0.75). Viewport is 4:5 (0.8).
            const sensorRatio = photo.width / photo.height;
            const targetRatio = 0.8; // 4:5
            
            let crop = { originX: 0, originY: 0, width: photo.width, height: photo.height };
            if (sensorRatio > targetRatio) {
                // Sensor is wider (e.g. 16:9) -> crop sides
                const targetWidth = photo.height * targetRatio;
                crop.originX = (photo.width - targetWidth) / 2;
                crop.width = targetWidth;
            } else {
                // Sensor is narrower (e.g. 3:4) -> crop top/bottom
                const targetHeight = photo.width / targetRatio;
                crop.originY = (photo.height - targetHeight) / 2;
                crop.height = targetHeight;
            }

            const resized = await manipulateAsync(
                photo.uri,
                [
                    { crop }, 
                    { resize: { width: 400 } }
                ],
                { format: SaveFormat.JPEG }
            );

            // 3. Crop each anchor region and measure visual complexity
            const result = await analyzeAlignmentByCrops(
                resized.uri,
                resized.width,
                resized.height,
                anchors,
            );

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

            if (result.score > 0.70) {
                setAlignState('approved');
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                setAlignState('rejected');
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }

            // Reset after 4 seconds
            resetTimerRef.current = setTimeout(() => {
                resetTimerRef.current = null;
                setAlignState('idle');
            }, 4000);

        } catch (e) {
            console.warn('Alignment check error:', e);
            setAlignState('idle');
        }
    }, [selectedTemplate, anchors]);

    /* ── Manual capture (locked unless approved or no template) ── */
    const canCapture = !selectedTemplate || alignState === 'approved';

    const handleCapture = async () => {
        if (!cameraRef.current || isCapturing || !canCapture) return;
        setIsCapturing(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
            if (photo?.uri) {
                setCapturedPhotoUri(photo.uri);
                navigation.navigate('Validate');
            }
        } catch (e) {
            console.warn('Capture error:', e);
        } finally {
            setIsCapturing(false);
        }
    };

    // Visual colors
    const overlayColor = stateColor(alignState);
    const isReady = alignState === 'approved';

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 42 }} />
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Camera Feed</Text>
                    <Text style={styles.headerSub}>4:5 ASPECT RATIO</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Main' as any)} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="cog-outline" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* Camera Viewport */}
            <View style={styles.viewport}>
                {permission?.granted ? (
                    <CameraView
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        facing={facing}
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

                {/* Letterbox bars */}
                {letterbarH > 0 && (
                    <>
                        <View style={[styles.letterbar, { height: letterbarH, top: 0 }]} />
                        <View style={[styles.letterbar, { height: letterbarH, bottom: 0 }]} />
                    </>
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

                {/* Fixed reference markers */}
                {selectedTemplate && guidesVisible && anchors.length > 0 && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        {anchors.map((anchor, i) => (
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

                {/* Status badge */}
                {selectedTemplate && (
                    <StatusBadge state={alignState} score={alignScore} />
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

                {/* Manual Alignment Scan Button (only when level) */}
                {isLevel && selectedTemplate && (alignState === 'ready' || alignState === 'rejected') && (
                    <TouchableOpacity 
                        style={styles.scanBtn} 
                        onPress={runAlignmentCheck}
                    >
                        <MaterialCommunityIcons name="magnify-scan" size={24} color="#fff" />
                        <Text style={styles.scanBtnText}>CHECK ALIGNMENT</Text>
                    </TouchableOpacity>
                )}

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
                <View style={[styles.sliderSection, !selectedTemplate && styles.dimmed]}>
                    <View style={styles.sliderHeader}>
                        <View style={styles.sliderLabelRow}>
                            <MaterialCommunityIcons name="layers" size={14} color={Colors.primary} />
                            <Text style={styles.sliderLabel}>ONION SKIN</Text>
                        </View>
                        <View style={styles.sliderValueBadge}>
                            <Text style={styles.sliderValueText}>{Math.round(overlayOpacity * 100)}%</Text>
                        </View>
                    </View>
                    <View style={styles.sliderTrack}>
                        <View style={[styles.sliderFill, { width: `${overlayOpacity * 100}%` }]} />
                        <View style={[styles.sliderThumb, { left: `${overlayOpacity * 100}%` }]} />
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={(e) => {
                                if (overlayLocked) return;
                                const newVal = Math.max(0, Math.min(1, e.nativeEvent.locationX / (SW - 40)));
                                setOverlayOpacity(parseFloat(newVal.toFixed(2)));
                            }}
                        />
                    </View>
                </View>

                {/* Granular Alignment Sliders */}
                {selectedTemplate && (
                    <View style={styles.alignmentSliders}>
                        {/* Wheelbase (if applicable) */}
                        {(selectedTemplate.id === 'car-side' || selectedTemplate.id === 'car-diagonal') && (
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
                                <View style={styles.sliderTrack}>
                                    <View style={[styles.sliderFill, { width: `${((wheelbaseScale - 0.5) / 1.0) * 100}%` }]} />
                                    <View style={[styles.sliderThumb, { left: `${((wheelbaseScale - 0.5) / 1.0) * 100}%` }]} />
                                    <TouchableOpacity
                                        style={StyleSheet.absoluteFill}
                                        activeOpacity={1}
                                        onPress={(e) => {
                                            if (overlayLocked) return;
                                            const newVal = 0.5 + (e.nativeEvent.locationX / (SW - 40)) * 1.0;
                                            setWheelbaseScale(parseFloat(Math.max(0.5, Math.min(1.5, newVal)).toFixed(2)));
                                        }}
                                    />
                                </View>
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
                            <View style={styles.sliderTrack}>
                                <View style={[styles.sliderFill, { 
                                    width: `${((verticalOffset + 0.1) / 0.2) * 100}%`,
                                    backgroundColor: Colors.warning 
                                }]} />
                                <View style={[
                                    styles.sliderThumb, 
                                    { 
                                        left: `${((verticalOffset + 0.1) / 0.2) * 100}%`, 
                                        backgroundColor: Colors.warning 
                                    }
                                ]} />
                                <TouchableOpacity
                                    style={StyleSheet.absoluteFill}
                                    activeOpacity={1}
                                    onPress={(e) => {
                                        if (overlayLocked) return;
                                        const newVal = -0.1 + (e.nativeEvent.locationX / (SW - 40)) * 0.2;
                                        setVerticalOffset(parseFloat(Math.max(-0.1, Math.min(0.1, newVal)).toFixed(2)));
                                    }}
                                />
                            </View>
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
                        disabled={isCapturing || !canCapture}
                    >
                        <View style={[
                            styles.shutterOuter,
                            isReady && { borderColor: 'rgba(34,197,94,0.6)', borderWidth: 3 },
                            alignState === 'ready' && { borderColor: 'rgba(234,179,8,0.5)' },
                            alignState === 'rejected' && { borderColor: 'rgba(239,68,68,0.5)' },
                        ]} />
                        <View style={[
                            styles.shutterInner,
                            isCapturing && { backgroundColor: Colors.primary },
                            isReady && { backgroundColor: '#22C55E' },
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
        const ratioBody = c / (details.bodyNoise || 1);
        
        // SYMMETRY-FIRST BYPASS: If Symmetry > 80%, we allow higher noise floor
        let reqRatio = 1.35; 
        if (details.symmetryRatio > 0.80) {
            reqRatio = 0.9; // Trust the pair even if background is busy
        } else if (c > 3500) {
            reqRatio = 1.1;
        }

        const pass = (c > threshold * 0.4) && (ratioNoise >= reqRatio) && (ratioBody >= reqRatio);
        
        details.anchorDetails.push({
            complexity: c,
            threshold,
            ratio: Math.min(ratioNoise, ratioBody), 
            reqRatio,
            pass
        });

        if (pass) {
            totalScore += Math.min(1, c / threshold);
        } else {
            if (c < threshold * 0.4) details.reasons.push(`[LOW_DETAIL_${i}]`);
            else if (ratioNoise < reqRatio) details.reasons.push(`[LOW_BG_RATIO_${i}]`);
            else if (ratioBody < reqRatio) details.reasons.push(`[LOW_BODY_RATIO_${i}]`);
        }
    }

    let finalScore = totalScore / (anchors.length || 1);

    // Final Symmetry Penalty
    if (details.symmetryRatio < 0.6) {
        finalScore *= details.symmetryRatio;
        details.reasons.push("[ASYMMETRIC]");
    }

    // Heavy Noise Penalty (Only if both symmetry is low AND noise is extreme)
    if (details.sceneNoise > 5500 && details.symmetryRatio < 0.8) {
        finalScore *= 0.5;
        details.reasons.push("[EXTREME_TEXTURE]");
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
    letterbar: {
        position: 'absolute', left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2,
    },
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
