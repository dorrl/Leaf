import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export function AnimatedPressable({ children, selected = false, onPressIn, onPressOut, ...props }: PressableProps & { children?: ReactNode; selected?: boolean }) {
    const scale = useSharedValue(selected ? 1.02 : 1);

    useEffect(() => {
        scale.value = withSpring(selected ? 1.02 : 1, { damping: 18, stiffness: 300 });
    }, [selected, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }), [scale]);

    return (
        <Pressable
            {...props}
            onPressIn={(event) => {
                scale.value = withSpring(0.97, { damping: 18, stiffness: 420 });
                onPressIn?.(event);
            }}
            onPressOut={(event) => {
                scale.value = withSpring(selected ? 1.02 : 1, { damping: 18, stiffness: 420 });
                onPressOut?.(event);
            }}
        >
            <Animated.View style={animatedStyle}>
                {children}
            </Animated.View>
        </Pressable>
    );
}
