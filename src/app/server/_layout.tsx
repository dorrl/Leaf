import { Stack } from 'expo-router';

export default function ServerLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="create" />
            <Stack.Screen name="[id]" />
            <Stack.Screen name="[id]/setting" />
            <Stack.Screen name="[id]/[pico]" />
        </Stack>
    );
}