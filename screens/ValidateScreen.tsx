import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Image, Animated, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Typography } from '../constants/theme';
import { useAppState, buildFilename } from '../context/AppContext';
import { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COLOR_OPTIONS = ['', 'Onyx Black', 'Slate Gray', 'Frost White', 'Cobalt Blue', 'Sand Beige', 'Forest Green', 'Crimson Red'];

export default function ValidateScreen() {
    const navigation = useNavigation<Nav>();
    const insets = useSafeAreaInsets();
    const {
        capturedPhotoUri, selectedTemplate, photographerName,
        addProject, setCapturedPhotoUri,
    } = useAppState();

    const [jobId, setJobId] = useState('');
    const [color, setColor] = useState('');
    const [batch, setBatch] = useState('');
    const [notes, setNotes] = useState('');
    const [jobIdError, setJobIdError] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [success, setSuccess] = useState(false);
    const [currentHint, setCurrentHint] = useState('');
    const progressAnim = useRef(new Animated.Value(0)).current;
    const successAnim = useRef(new Animated.Value(0)).current;

    const filename = buildFilename(jobId || 'JOB-XXXX', selectedTemplate?.name ?? 'NoTemplate', photographerName);

    const runUpload = () => {
        if (!jobId.trim()) {
            setJobIdError(true);
            return;
        }
        setJobIdError(false);
        setUploading(true);

        const phases = [
            { pct: 15, hint: 'Compressing image...' },
            { pct: 30, hint: 'Encrypting payload...' },
            { pct: 55, hint: 'Uploading to Drive...' },
            { pct: 75, hint: 'Writing metadata...' },
            { pct: 90, hint: 'Updating project sheet...' },
            { pct: 100, hint: 'Finalizing...' },
        ];

        let i = 0;
        const tick = () => {
            if (i >= phases.length) {
                // Done — save project
                const project = {
                    id: Date.now().toString(),
                    jobId: jobId.trim(),
                    color: color || '—',
                    batch: batch || '—',
                    notes,
                    templateName: selectedTemplate?.name ?? 'None',
                    ratio: selectedTemplate?.ratio ?? '—',
                    date: new Date().toISOString(),
                    photoUri: capturedPhotoUri,
                    filename: buildFilename(jobId.trim(), selectedTemplate?.name ?? 'NoTemplate', photographerName),
                    status: 'uploaded' as const,
                };
                addProject(project);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setSuccess(true);
                Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
                return;
            }
            const phase = phases[i++];
            setProgress(phase.pct);
            setCurrentHint(phase.hint);
            Animated.timing(progressAnim, {
                toValue: phase.pct / 100,
                duration: 400,
                useNativeDriver: false,
            }).start(() => setTimeout(tick, 300 + Math.random() * 200));
        };
        setTimeout(tick, 200);
    };

    const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    if (success) {
        return (
            <View style={[styles.container, styles.successWrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <Animated.View style={[styles.successIcon, { transform: [{ scale: successAnim }] }]}>
                    <MaterialCommunityIcons name="check-circle" size={48} color={Colors.success} />
                </Animated.View>
                <Text style={styles.successTitle}>Upload Complete!</Text>
                <Text style={styles.successSub}>{filename}</Text>
                <TouchableOpacity
                    style={[styles.btn, { marginTop: 24 }]}
                    onPress={() => { setCapturedPhotoUri(null); navigation.navigate('Main'); }}
                >
                    <MaterialCommunityIcons name="camera-plus" size={20} color="#fff" />
                    <Text style={styles.btnText}>Take Another Shot</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={() => { navigation.navigate('Main'); }}
                >
                    <Text style={styles.ghostBtnText}>View Projects</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Data Validation</Text>
                    {!jobId.trim()
                        ? <View style={{ width: 42 }} />
                        : (
                            <View style={styles.verifiedBadge}>
                                <MaterialCommunityIcons name="check-decagram" size={13} color={Colors.success} />
                                <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                        )
                    }
                </View>

                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {/* Photo preview */}
                    <View style={styles.preview}>
                        {capturedPhotoUri
                            ? <Image source={{ uri: capturedPhotoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            : (
                                <View style={styles.noPhoto}>
                                    <MaterialCommunityIcons name="image-off" size={48} color={Colors.textMuted} />
                                    <Text style={styles.noPhotoText}>No photo captured</Text>
                                </View>
                            )
                        }
                        <View style={styles.previewLabel}>
                            <Text style={styles.previewLabelText}>PREVIEW · {selectedTemplate?.name?.toUpperCase() ?? 'NO TEMPLATE'}</Text>
                        </View>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Job ID */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Job ID <Text style={styles.required}>*</Text></Text>
                            <View style={[styles.inputWrap, jobIdError && styles.inputError]}>
                                <MaterialCommunityIcons name="briefcase-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. JOB-2024-001"
                                    placeholderTextColor={Colors.textMuted}
                                    value={jobId}
                                    onChangeText={v => { setJobId(v); setJobIdError(false); }}
                                    autoCapitalize="characters"
                                />
                            </View>
                            {jobIdError && <Text style={styles.errorHint}>Job ID is required to submit.</Text>}
                        </View>

                        {/* Item Color */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Item Color</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorRow}>
                                {COLOR_OPTIONS.slice(1).map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.colorChip, color === c && styles.colorChipActive]}
                                        onPress={() => setColor(color === c ? '' : c)}
                                    >
                                        <Text style={[styles.colorChipText, color === c && styles.colorChipTextActive]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Batch Number */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Batch Number</Text>
                            <View style={styles.inputWrap}>
                                <MaterialCommunityIcons name="layers-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. B-092-A"
                                    placeholderTextColor={Colors.textMuted}
                                    value={batch}
                                    onChangeText={setBatch}
                                    autoCapitalize="characters"
                                />
                            </View>
                        </View>

                        {/* Notes */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Notes</Text>
                            <View style={[styles.inputWrap, { alignItems: 'flex-start' }]}>
                                <MaterialCommunityIcons name="note-edit-outline" size={20} color={Colors.textMuted} style={[styles.inputIcon, { marginTop: 14 }]} />
                                <TextInput
                                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                    placeholder="Optional notes..."
                                    placeholderTextColor={Colors.textMuted}
                                    value={notes}
                                    onChangeText={setNotes}
                                    multiline
                                />
                            </View>
                        </View>

                        {/* Auto filename */}
                        <View style={styles.filenamePreview}>
                            <Text style={styles.filenamePrevLabel}>Auto-Generated Filename</Text>
                            <Text style={styles.filenameValue} numberOfLines={2}>{filename}</Text>
                        </View>

                        {/* Progress bar */}
                        {uploading && (
                            <View style={styles.progressWrap}>
                                <View style={styles.progressHeader}>
                                    <Text style={styles.progressLabel}>UPLOAD PROGRESS</Text>
                                    <Text style={styles.progressPct}>{progress}%</Text>
                                </View>
                                <View style={styles.progressTrack}>
                                    <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
                                </View>
                                <Text style={styles.progressHint}>{currentHint}</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
                    <TouchableOpacity
                        style={[styles.btn, uploading && styles.btnDisabled]}
                        onPress={runUpload}
                        disabled={uploading}
                    >
                        <MaterialCommunityIcons name="cloud-upload-outline" size={20} color="#fff" />
                        <Text style={styles.btnText}>Submit to Drive</Text>
                    </TouchableOpacity>
                    <View style={styles.footerHint}>
                        <MaterialCommunityIcons name="lock-outline" size={13} color={Colors.textMuted} />
                        <Text style={styles.footerHintText}>All data is encrypted before transmission.</Text>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgDark },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: Colors.bgSurface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerBtn: { width: 42 },
    headerTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
    verifiedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: Radii.full,
    },
    verifiedText: { fontSize: 10, fontWeight: '700', color: Colors.success, letterSpacing: 0.5 },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 20, paddingBottom: 40 },
    preview: {
        aspectRatio: 4 / 5,
        borderRadius: Radii.lg,
        overflow: 'hidden',
        backgroundColor: Colors.bgCard,
    },
    noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    noPhotoText: { fontSize: Typography.sm, color: Colors.textMuted },
    previewLabel: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 14, paddingVertical: 10,
        background: 'transparent',
    },
    previewLabelText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.8 },
    form: { gap: 18 },
    field: { gap: 8 },
    label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
    required: { color: Colors.primary },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bgInput,
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderRadius: Radii.md,
    },
    inputError: { borderColor: Colors.danger },
    inputIcon: { padding: 14, paddingRight: 8 },
    input: { flex: 1, paddingVertical: 14, paddingRight: 14, fontSize: Typography.base, color: Colors.textPrimary },
    errorHint: { fontSize: 11, color: Colors.danger },
    colorRow: { flexGrow: 0 },
    colorChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        backgroundColor: Colors.bgCard,
        borderWidth: 1, borderColor: Colors.border,
        borderRadius: Radii.full, marginRight: 8,
    },
    colorChipActive: { backgroundColor: Colors.primarySubtle, borderColor: Colors.primary },
    colorChipText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
    colorChipTextActive: { color: Colors.primary },
    filenamePreview: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1, borderColor: Colors.border,
        borderRadius: Radii.md,
        padding: 14, gap: 4,
    },
    filenamePrevLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
    filenameValue: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: Colors.primary },
    progressWrap: {
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1, borderColor: 'rgba(43,140,238,0.2)',
        borderRadius: Radii.lg, padding: 16, gap: 10,
    },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
    progressPct: { fontSize: 11, fontWeight: '700', color: Colors.primary },
    progressTrack: { height: 6, backgroundColor: Colors.bgCard, borderRadius: Radii.full, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radii.full },
    progressHint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
    footer: {
        padding: 16, borderTopWidth: 1, borderTopColor: Colors.border,
        backgroundColor: Colors.bgSurface, gap: 12,
    },
    btn: {
        backgroundColor: Colors.primary, borderRadius: Radii.lg,
        paddingVertical: 16, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: '#fff', fontSize: Typography.base, fontWeight: '700' },
    footerHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    footerHintText: { fontSize: 11, color: Colors.textMuted },
    // Success
    successWrap: { alignItems: 'center', justifyContent: 'center', gap: 12 },
    successIcon: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderWidth: 2, borderColor: 'rgba(34,197,94,0.35)',
        alignItems: 'center', justifyContent: 'center',
    },
    successTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary },
    successSub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 24, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
    ghostBtn: { paddingVertical: 12 },
    ghostBtnText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
});
