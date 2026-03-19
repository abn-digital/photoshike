import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radii, Typography } from '../constants/theme';
import { RootStackParamList } from '../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Lobby'> };

export default function LobbyScreen({ navigation }: Props) {
    const glowAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
                <View style={styles.logoWrap}>
                    <Animated.View style={[StyleSheet.absoluteFill, styles.glow, { opacity: glowOpacity }]} />
                    <MaterialCommunityIcons name="camera-enhance" size={48} color={Colors.primary} />
                </View>
                <Text style={styles.title}>Photoshike</Text>
                <Text style={styles.sub}>Professional Onion Skin Photography</Text>
                <TouchableOpacity
                    style={styles.btn}
                    activeOpacity={0.85}
                    onPress={() => navigation.replace('Main')}
                >
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                    <Text style={styles.btnText}>Get Started</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inner: {
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 32,
    },
    logoWrap: {
        width: 88,
        height: 88,
        borderRadius: Radii.xl,
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: 'rgba(43,140,238,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        overflow: 'hidden',
    },
    glow: {
        backgroundColor: 'rgba(43,140,238,0.25)',
        borderRadius: Radii.xl,
    },
    title: {
        fontSize: Typography.xxl,
        fontWeight: '800',
        color: Colors.textPrimary,
        letterSpacing: -0.5,
    },
    sub: {
        fontSize: Typography.sm,
        color: Colors.textSecondary,
        fontWeight: '500',
        textAlign: 'center',
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        paddingHorizontal: 28,
        borderRadius: Radii.lg,
        marginTop: 16,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    btnText: {
        color: '#fff',
        fontSize: Typography.md,
        fontWeight: '700',
    },
});
