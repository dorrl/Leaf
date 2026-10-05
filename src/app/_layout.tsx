import {
    initializeNotificationForeground,
    subscribePushTokenRefresh,
} from '@/services/notificationBackground';
import { ServerAddressProvider } from '@/hooks/useServerAddress';
import { ThemeProvider } from '@/hooks/useTheme';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const router = useRouter();
    const notificationResponseHandled = useRef<string | null>(null);
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
        if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden');
    }, []);

    useEffect(() => {
        if (!loaded && !error) return;

        const openNotificationTarget = (response: Notifications.NotificationResponse) => {
            const identifier = response.notification.request.identifier;
            if (notificationResponseHandled.current === identifier) return;
            notificationResponseHandled.current = identifier;

            const data = response.notification.request.content.data as {
                serverId?: unknown;
                picoId?: unknown;
            };
            if (typeof data.serverId !== 'string' || !data.serverId) return;

            if (typeof data.picoId === 'string' && data.picoId) {
                router.push({ pathname: '/server/[id]/[pico]', params: { id: data.serverId, pico: data.picoId } });
            } else {
                router.push({ pathname: '/server/[id]', params: { id: data.serverId } });
            }
        };

        const subscription = Notifications.addNotificationResponseReceivedListener(openNotificationTarget);
        void Notifications.getLastNotificationResponseAsync().then(response => {
            if (response) openNotificationTarget(response);
        });

        return () => subscription.remove();
    }, [loaded, error, router]);

    useEffect(() => {
        if (!loaded && !error) return;

        let active = true;
        let unsubscribe: (() => void) | null = null;

        void (async () => {
            const allowed = await initializeNotificationForeground();
            if (!active || !allowed) return;

            unsubscribe = subscribePushTokenRefresh();
        })();

        return () => {
            active = false;
            unsubscribe?.();
        };
    }, [loaded, error]);

    useEffect(() => {
        if (loaded || error) SplashScreen.hideAsync();
    }, [loaded, error]);

    if (!loaded && !error) return null;

    return (
        <ThemeProvider>
            <ServerAddressProvider>
                <Stack screenOptions={{ headerShown: false, navigationBarHidden: true }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="server" />
                </Stack>
            </ServerAddressProvider>
        </ThemeProvider>
    );
}
