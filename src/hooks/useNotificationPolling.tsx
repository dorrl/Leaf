import { useServerAddress } from '@/hooks/useServerAddress';
import { pollNotificationServers, requestNotificationPermission, syncBackgroundNotificationTask } from '@/utils/notificationPolling';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export function NotificationPollingRuntime() {
    const { servers, loaded } = useServerAddress();

    useEffect(() => {
        if (!loaded || Platform.OS === 'web') return;

        let active = true;
        let polling = false;
        let timer: ReturnType<typeof setInterval> | undefined;

        const poll = async () => {
            if (!active || polling) return;
            polling = true;
            try {
                const intervalMinutes = await pollNotificationServers(servers);
                if (!active) return;
                await syncBackgroundNotificationTask(servers.length > 0, intervalMinutes);
                if (!active) return;
                if (timer) clearInterval(timer);
                timer = setInterval(() => { void poll(); }, intervalMinutes * 60_000);
            } finally {
                polling = false;
            }
        };

        const start = async () => {
            const permissionGranted = await requestNotificationPermission();
            if (!active) return;
            if (permissionGranted) {
                await poll();
            } else {
                await syncBackgroundNotificationTask(false, 15);
            }
        };

        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') void poll();
        });
        void start();

        return () => {
            active = false;
            if (timer) clearInterval(timer);
            subscription.remove();
        };
    }, [loaded, servers]);

    return null;
}