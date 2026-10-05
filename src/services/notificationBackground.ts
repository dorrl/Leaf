import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

const STORAGE_KEY = '@smartfarm/server-configs';
const PERMISSION_REQUESTED_KEY = '@smartfarm/notification-permission-requested';
const API_PREFIX = 'smartfarm-api-key-';
const NOTIFICATION_CHANNEL = 'smartfarm-alerts';
const DEVICE_REGISTRATION_PATH = '/notifications/device';

type Server = { id: string; name: string; address: string };

const getApiKeyStorageKey = (id: string) => {
    const safeId = id.replace(/[^A-Za-z0-9._-]/g, '_');
    return safeId ? `smartfarm-api-key-${safeId}` : '';
};

async function loadServers(): Promise<Server[]> {
    try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed)
            ? parsed.filter((server): server is Server =>
                !!server && typeof server === 'object'
                && typeof (server as Server).id === 'string'
                && typeof (server as Server).name === 'string'
                && typeof (server as Server).address === 'string')
            : [];
    } catch {
        return [];
    }
}

async function registerDeviceToken(token: string, platform: 'android' | 'ios') {
    const servers = await loadServers();
    if (!servers.length) return;

    await Promise.allSettled(servers.map(async server => {
        const address = server.address.trim();
        if (!address) return;

        const base = (address.startsWith('http') ? address : `http://${address}`).replace(/\/+$/, '');
        const apiKey = await SecureStore.getItemAsync(getApiKeyStorageKey(server.id));

        await fetch(`${base}${DEVICE_REGISTRATION_PATH}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(apiKey ? { 'X-API-Key': apiKey } : {}),
            },
            body: JSON.stringify({
                token,
                platform,
            }),
        });
    }));
}

async function requestNotificationPermissionOnce() {
    if (Platform.OS === 'web') return false;

    const requested = await AsyncStorage.getItem(PERMISSION_REQUESTED_KEY);
    if (requested === 'true') {
        const settings = await Notifications.getPermissionsAsync();
        return settings.granted;
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
            name: 'SmartFarm 알림',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250],
        });
    }

    await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');

    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;

    const result = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return result.granted;
}

export async function initializeNotificationForeground() {
    if (Platform.OS === 'web') return false;

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });

    const allowed = await requestNotificationPermissionOnce();
    if (!allowed) return false;

    try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        if (deviceToken.data) {
            await registerDeviceToken(deviceToken.data, Platform.OS === 'android' ? 'android' : 'ios');
        }
    } catch {
        // FCM/APNs token을 아직 발급할 수 없는 환경에서는 앱 사용을 막지 않습니다.
    }

    return true;
}

export function subscribePushTokenRefresh() {
    if (Platform.OS === 'web') return () => {};

    const subscription = Notifications.addPushTokenListener(token => {
        void registerDeviceToken(
            token.data,
            Platform.OS === 'android' ? 'android' : 'ios',
        );
    });

    return () => subscription.remove();
}
