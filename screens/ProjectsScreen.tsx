import React from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Radii, Typography } from '../constants/theme';
import { useAppState, Project } from '../context/AppContext';
import { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectsScreen() {
    const insets = useSafeAreaInsets();
    const { projects, clearProjects } = useAppState();

    const handleClear = () => {
        Alert.alert('Clear All Projects', 'This will permanently delete all saved projects. Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear All', style: 'destructive', onPress: clearProjects },
        ]);
    };

    const renderItem = ({ item }: { item: Project }) => (
        <View style={styles.card}>
            {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.cardThumb} resizeMode="cover" />
            ) : (
                <View style={[styles.cardThumb, styles.noThumb]}>
                    <MaterialCommunityIcons name="image-off" size={28} color={Colors.textMuted} />
                </View>
            )}
            <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                    <Text style={styles.cardJobId}>{item.jobId}</Text>
                    <View style={[styles.badge, item.status === 'uploaded' ? styles.badgeGreen : styles.badgeYellow]}>
                        <MaterialCommunityIcons
                            name={item.status === 'uploaded' ? 'cloud-check' : 'clock-outline'}
                            size={11}
                            color={item.status === 'uploaded' ? Colors.success : Colors.warning}
                        />
                        <Text style={[styles.badgeText, item.status === 'uploaded' ? styles.badgeTextGreen : styles.badgeTextYellow]}>
                            {item.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                        </Text>
                    </View>
                </View>
                <Text style={styles.cardTemplate}>{item.templateName} · {item.ratio}</Text>
                {item.color !== '—' && <Text style={styles.cardMeta}>{item.color}</Text>}
                <View style={styles.cardFooter}>
                    <MaterialCommunityIcons name="calendar-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                </View>
                <Text style={styles.cardFilename} numberOfLines={1}>{item.filename}</Text>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Projects</Text>
                {projects.length > 0 && (
                    <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color={Colors.danger} />
                        <Text style={styles.clearText}>Clear All</Text>
                    </TouchableOpacity>
                )}
            </View>

            {projects.length === 0 ? (
                <View style={styles.empty}>
                    <MaterialCommunityIcons name="image-multiple-outline" size={64} color={Colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Projects Yet</Text>
                    <Text style={styles.emptyText}>Capture your first photo and it'll appear here.</Text>
                </View>
            ) : (
                <FlatList
                    data={projects}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgDark },
    header: {
        height: 56,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 20,
        backgroundColor: Colors.bgSurface,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
    clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    clearText: { fontSize: Typography.sm, color: Colors.danger, fontWeight: '600' },
    listContent: { padding: 16, gap: 14 },
    card: {
        backgroundColor: Colors.bgCard,
        borderWidth: 1, borderColor: Colors.border,
        borderRadius: Radii.lg, overflow: 'hidden',
        flexDirection: 'row',
    },
    cardThumb: { width: 100, height: 130 },
    noThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSurface },
    cardBody: { flex: 1, padding: 14, gap: 5 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardJobId: { fontSize: Typography.base, fontWeight: '800', color: Colors.textPrimary },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: Radii.full, borderWidth: 1,
    },
    badgeGreen: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.25)' },
    badgeYellow: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)' },
    badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    badgeTextGreen: { color: Colors.success },
    badgeTextYellow: { color: Colors.warning },
    cardTemplate: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
    cardMeta: { fontSize: Typography.xs, color: Colors.textMuted },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    cardDate: { fontSize: 11, color: Colors.textMuted },
    cardFilename: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },
    empty: {
        flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40,
    },
    emptyTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
    emptyText: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
});
