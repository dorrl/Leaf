import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Pressable } from 'react-native';

export function BackButton({ onPress, color, backgroundColor }: {
    onPress: () => void;
    color: string;
    backgroundColor: string;
}) {
    return (
        <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            onPress={onPress}
            style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: backgroundColor,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor,
            }}
        >
            <Ionicons name="chevron-back" size={22} color={color} />
        </AnimatedPressable>
    );
}