import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

interface DeviceLevelResult {
    /** Roll angle in degrees (0 = perfectly level). */
    roll: number;
    /** True when |roll| < threshold. */
    isLevel: boolean;
}

const DEG = 180 / Math.PI;
const DEFAULT_THRESHOLD_DEG = 5;
const UPDATE_INTERVAL_MS = 33; // ~30 Hz

export function useDeviceLevel(thresholdDeg = DEFAULT_THRESHOLD_DEG): DeviceLevelResult {
    const [roll, setRoll] = useState(0);
    const subRef = useRef<any>(null);

    useEffect(() => {
        // Accelerometer is not available on web
        if (Platform.OS === 'web') return;

        try {
            Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);

            subRef.current = Accelerometer.addListener(({ x, y, z }) => {
                // atan2(x, √(y²+z²)) isolates lateral roll, ignoring forward/backward pitch
                const angleDeg = Math.atan2(x, Math.sqrt(y * y + z * z)) * DEG;
                
                // Apply a low-pass filter (Exponential Moving Average) for smoother, slower animation
                // alpha = 0.15 means 15% new value, 85% old value. Lower alpha = smoother & slower
                setRoll((prevRoll) => {
                    const alpha = 0.15; 
                    return prevRoll * (1 - alpha) + angleDeg * alpha;
                });
            });
        } catch (e) {
            // Sensor unavailable (e.g. emulator without sensor support)
            console.warn('Accelerometer not available:', e);
        }

        return () => {
            subRef.current?.remove();
            subRef.current = null;
        };
    }, []);

    return {
        roll,
        isLevel: Math.abs(roll) < thresholdDeg,
    };
}
