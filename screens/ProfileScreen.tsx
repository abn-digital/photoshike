import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Radii, Typography } from '../constants/theme';
import { useAppState } from '../context/AppContext';
import { CAR_TEMPLATES } from '../components/CarSVGs';

const ASPECT_RATIOS = ['4:5', '4:3', '1:1', '16:9'];

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const {
        photographerName, setPhotographerName,
        defaultAspectRatio, setDefaultAspectRatio,
        autoFilename, setAutoFilename,
        projects, clearProjects,
    } = useAppState();

    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(photographerName);

    const cycleRatio = () => {
        const idx = ASPECT_RATIOS.indexOf(defaultAspectRatio);
        setDefaultAspectRatio(ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length]);
    };

    const confirmClear = () => {
        Alert.alert('Clear All Local Data', 'This will delete all projects and reset settings. Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: clearProjects },
        ]);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Avatar + name */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <MaterialCommunityIcons name="account" size={40} color={Colors.primary} />
                    </View>
                    <View style={styles.profileInfo}>
                        {editingName ? (
                            <TextInput
                                style={styles.nameInput}
                                value={nameInput}
                                onChangeText={setNameInput}
                                autoFocus
                                onBlur={() => {
                                    setPhotographerName(nameInput.trim() || 'Photographer');
                                    setEditingName(false);
                                }}
                                returnKeyType="done"
                            />
                        ) : (
                            <TouchableOpacity style={styles.nameRow} onPress={() => { setNameInput(photographerName); setEditingName(true); }}>
                                <Text style={styles.name}>{photographerName}</Text>
                                <MaterialCommunityIcons name="pencil-outline" size={16} color={Colors.primary} />
                            </TouchableOpacity>
                        )}
                        <Text style={styles.role}>Automotive Photographer</Text>
                    </View>
                </View>

                {/* Settings */}
                <Text style={styles.sectionTitle}>SETTINGS</Text>
                <View style={styles.settingsCard}>
                    {/* Default aspect ratio */}
                    <TouchableOpacity style={styles.settingRow} onPress={cycleRatio}>
                        <View style={styles.settingLeft}>
                            <MaterialCommunityIcons name="aspect-ratio" size={20} color={Colors.primary} />
                            <View>
                                <Text style={styles.settingLabel}>Default Aspect Ratio</Text>
                                <Text style={styles.settingHint}>Tap to cycle</Text>
                            </View>
                        </View>
                        <View style={styles.ratioBadge}>
                            <Text style={styles.ratioText}>{defaultAspectRatio}</Text>
                        </View>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    {/* Auto filename */}
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <MaterialCommunityIcons name="text-box-outline" size={20} color={Colors.primary} />
                            <View>
                                <Text style={styles.settingLabel}>Auto-Filename</Text>
                                <Text style={styles.settingHint}>Auto-generate filenames on capture</Text>
                            </View>
                        </View>
                        <Switch
                            value={autoFilename}
                            onValueChange={setAutoFilename}
                            trackColor={{ false: Colors.bgCard, true: Colors.primary }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {/* Stats */}
                <Text style={styles.sectionTitle}>STATS</Text>
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{projects.length}</Text>
                        <Text style={styles.statLabel}>Projects</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{CAR_TEMPLATES.length}</Text>
                        <Text style={styles.statLabel}>Templates</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>v1.0</Text>
                        <Text style={styles.statLabel}>Version</Text>
                    </View>
                </View>

                {/* Danger zone */}
                <View style={styles.dangerCard}>
                    <TouchableOpacity style={styles.dangerBtn} onPress={confirmClear}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.danger} />
                        <Text style={styles.dangerText}>Clear All Local Data</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.footerNote}>Photoshike v1.0.0 · Built with Expo</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgDark },
    header: {
        height: 56, paddingHorizontal: 20, justifyContent: 'center',
        backgroundColor: Colors.bgSurface,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, gap: 12, paddingBottom: 48 },
    profileCard: {
        backgroundColor: Colors.bgCard,
        borderWidth: 1, borderColor: Colors.border,
        borderRadius: Radii.xl, padding: 20,
        flexDirection: 'row', alignItems: 'center', gap: 16,
        marginBottom: 8,
    },
    avatar: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: Colors.primarySubtle,
        borderWidth: 2, borderColor: 'rgba(43,140,238,0.3)',
        alignItems: 'center', justifyContent: 'center',
    },
    profileInfo: { flex: 1, gap: 6 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
    nameInput: {
        fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary,
        borderBottomWidth: 1.5, borderBottomColor: Colors.primary,
        paddingBottom: 2,
    },
    role: { fontSize: Typography.xs, color: Colors.textMuted },
    sectionTitle: {
        fontSize: 10, fontWeight: '700', color: Colors.textMuted,
        letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12,
    },
    settingsCard: {
        backgroundColor: Colors.bgCard,
        borderWidth: 1, borderColor: Colors.border,
        borderRadius: Radii.lg, overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, gap: 14,
    },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    settingLabel: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
    settingHint: { fontSize: 11, color: Colors.textMuted },
    ratioBadge: {
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1, borderColor: 'rgba(43,140,238,0.3)',
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: Radii.full,
    },
    ratioText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.primary },
    divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
    statsCard: {
        backgroundColor: Colors.bgCard,
        borderWidth: 1, borderColor: Colors.border,
        borderRadius: Radii.lg, flexDirection: 'row',
        overflow: 'hidden',
    },
    statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 4 },
    statValue: { fontSize: Typography.xxl, fontWeight: '800', color: Colors.textPrimary },
    statLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
    statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 16 },
    dangerCard: {
        backgroundColor: Colors.bgCard,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
        borderRadius: Radii.lg, marginTop: 8,
    },
    dangerBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: 16,
    },
    dangerText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.danger },
    footerNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 16 },
});
