import { ServerAddressProvider } from '@/hooks/useServerAddress';
import { ThemeProvider } from '@/hooks/useTheme';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [loaded, error] = useFonts({
        'Pretendard-Thin': require('../../assets/fonts/Pretendard/Thin.otf'),
        'Pretendard-ExtraLight': require('../../assets/fonts/Pretendard/ExtraLight.otf'),
        'Pretendard-Light': require('../../assets/fonts/Pretendard/Light.otf'),
        'Pretendard-Regular': require('../../assets/fonts/Pretendard/Regular.otf'),
        'Pretendard-Medium': require('../../assets/fonts/Pretendard/Medium.otf'),
        'Pretendard-SemiBold': require('../../assets/fonts/Pretendard/Semibold.otf'),
        'Pretendard-Bold': require('../../assets/fonts/Pretendard/Bold.otf'),
        'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard/ExtraBold.otf'),
        'Pretendard-Black': require('../../assets/fonts/Pretendard/Black.otf'),
    });

    useEffect(() => {
        if (loaded || error) {
            SplashScreen.hideAsync();
        }
    }, [loaded, error]);

    if (!loaded && !error) {
        return null;
    }

    return (
        <ThemeProvider>
            <ServerAddressProvider>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name='server' />
                </Stack>
            </ServerAddressProvider>
        </ThemeProvider>
    );
}
