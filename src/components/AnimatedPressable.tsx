import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export function AnimatedPressable({ children, onPressIn, onPressOut, ...props }: PressableProps & { children?: ReactNode }) {
    const scale = useSharedValue(1);

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
                scale.value = withSpring(1, { damping: 18, stiffness: 420 });
                onPressOut?.(event);
            }}
        >
            <Animated.View style={animatedStyle}>
                {children}
            </Animated.View>
        </Pressable>
    );
}
