import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radii, Typography } from '../constants/theme';
import { RootStackParamList } from '../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Lobby'> };


export default function LobbyScreen({ navigation }: Props) {
    const devNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
            {/* DEV MODE entry — DISABLED after 2026-03-30 calibration session.
                To re-enable: uncomment the block below and set __DEV__ guard if needed.
                See screens/AnchorDevModeScreen.tsx for full instructions. */}
            {/* {__DEV__ && (
                <TouchableOpacity
                    style={styles.devBtn}
                    onPress={() => devNav.navigate('AnchorDevMode')}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="wrench" size={11} color="#FCD34D" />
                    <Text style={styles.devBtnText}>DEV: Anchor Editor</Text>
                </TouchableOpacity>
            )} */}
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
    devBtn: {
        position: 'absolute',
        bottom: 28,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(252,211,77,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(252,211,77,0.3)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: Radii.full,
    },
    devBtnText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FCD34D',
        letterSpacing: 0.5,
    },
});
