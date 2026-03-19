import React, { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Radii, Typography } from '../constants/theme';
import { useAppState } from '../context/AppContext';
import { CAR_TEMPLATES, TemplateSVG } from '../components/CarSVGs';
import { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Category = 'All' | 'Exterior';
const CATEGORIES: Category[] = ['All', 'Exterior'];
const { width: SW } = Dimensions.get('window');
const CARD_SIZE = (SW - 48) / 2;

export default function TemplatesScreen() {
    const navigation = useNavigation<Nav>();
    const insets = useSafeAreaInsets();
    const { selectedTemplate, setSelectedTemplate } = useAppState();
    const [activeTab, setActiveTab] = useState<Category>('All');
    const [syncing, setSyncing] = useState(false);

    const filtered = activeTab === 'All' ? CAR_TEMPLATES : CAR_TEMPLATES.filter(t => t.category === activeTab);

    const handleSync = () => {
        setSyncing(true);
        setTimeout(() => setSyncing(false), 1800);
    };

    const handleSelect = (id: string) => {
        const tmpl = CAR_TEMPLATES.find(t => t.id === id);
        if (tmpl) {
            setSelectedTemplate(tmpl);
            navigation.goBack();
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.textPrimary} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Overlay Templates</Text>
                <TouchableOpacity onPress={handleSync} style={styles.syncBtn}>
                    <MaterialCommunityIcons
                        name="sync"
                        size={18}
                        color={Colors.textSecondary}
                        style={syncing ? { transform: [{ rotate: '45deg' }] } : undefined}
                    />
                    <Text style={styles.syncText}>Sync</Text>
                </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <View style={styles.tabBar}>
                {CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={styles.tabItem}
                        onPress={() => setActiveTab(cat)}
                    >
                        <Text style={[styles.tabText, activeTab === cat && styles.tabTextActive]}>{cat}</Text>
                        {activeTab === cat && <View style={styles.tabUnderline} />}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Grid */}
            <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                numColumns={2}
                contentContainerStyle={styles.gridContent}
                columnWrapperStyle={styles.columnWrap}
                renderItem={({ item }) => {
                    const isSelected = selectedTemplate?.id === item.id;
                    return (
                        <TouchableOpacity
                            style={[styles.card, isSelected && styles.cardSelected]}
                            activeOpacity={0.8}
                            onPress={() => handleSelect(item.id)}
                        >
                            <View style={styles.thumbWrap}>
                                <TemplateSVG templateId={item.id} size={CARD_SIZE - 24} featureScale={1.0} />
                                {isSelected && (
                                    <View style={styles.checkBadge}>
                                        <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                                    </View>
                                )}
                            </View>
                            <View style={styles.cardInfo}>
                                <Text style={styles.cardName}>{item.name}</Text>
                                <Text style={styles.cardRatio}>{item.ratio} Ratio</Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="image-off-outline" size={48} color={Colors.textMuted} />
                        <Text style={styles.emptyText}>No templates in this category</Text>
                    </View>
                }
            />
        </View>
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
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 64 },
    backText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600' },
    headerTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
    syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 64, justifyContent: 'flex-end' },
    syncText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600' },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: Colors.bgSurface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingHorizontal: 8,
    },
    tabItem: { paddingHorizontal: 12, paddingVertical: 12, position: 'relative' },
    tabText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },
    tabTextActive: { color: Colors.primary },
    tabUnderline: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 2,
        backgroundColor: Colors.primary,
        borderRadius: 1,
    },
    gridContent: { padding: 16, gap: 14 },
    columnWrap: { gap: 14, justifyContent: 'space-between' },
    card: {
        width: CARD_SIZE,
        backgroundColor: Colors.bgCard,
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderRadius: Radii.lg,
        overflow: 'hidden',
    },
    cardSelected: {
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    thumbWrap: {
        aspectRatio: 1,
        backgroundColor: Colors.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        position: 'relative',
    },
    checkBadge: {
        position: 'absolute',
        top: 6, right: 6,
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        width: 22, height: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardInfo: { padding: 10 },
    cardName: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
    cardRatio: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
    empty: { alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 },
    emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
});
