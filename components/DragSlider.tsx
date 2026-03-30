import React, { useRef, useEffect } from 'react';
import { View, PanResponder, Dimensions, StyleSheet } from 'react-native';
import { Colors, Radii } from '../constants/theme';

const { width: SW } = Dimensions.get('window');

interface DragSliderProps {
    value: number;
    onValueChange: (v: number) => void;
    min: number;
    max: number;
    disabled?: boolean;
    fillColor?: string;
    thumbColor?: string;
    trackWidth?: number;
}

export function DragSlider({
    value, onValueChange, min, max, disabled, fillColor, thumbColor, trackWidth,
}: DragSliderProps) {
    const tw = trackWidth ?? SW - 40;
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

const styles = StyleSheet.create({
    sliderTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: Radii.full,
        overflow: 'visible',
        position: 'relative',
        justifyContent: 'center',
    },
    sliderFill: {
        height: 6,
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
    },
    sliderThumb: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.primary,
        marginLeft: -10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
});
