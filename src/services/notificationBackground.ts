import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = '@smartfarm/server-configs';
const SEEN_KEY = '@smartfarm/foreground-notification-seen';
const API_PREFIX = 'smartfarm-api-key-';
const INTERVAL = 30_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

type Server = {
    id: string;
    name: string;
    address: string;
};

type Item = {
    id?: string | number;
    message?: unknown;
    picoId?: unknown;
    picoName?: unknown;
    createdAt?: unknown;
};

const getApiKeyStorageKey = (id: string) => {
    const safeId = id.replace(/[^A-Za-z0-9._-]/g, '_');
    return safeId ? `${API_PREFIX}${safeId}` : '';
};

const getItemKey = (serverId: string, notification: Item) =>
    notification.id !== undefined && notification.id !== null
        ? `${serverId}:${String(notification.id)}`
        : [
            serverId,
            notification.createdAt ?? '',
            notification.picoId ?? '',
            notification.message ?? '',
        ].join(':');

async function loadServers(): Promise<Server[]> {
    try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = saved ? JSON.parse(saved) : [];

        return Array.isArray(parsed)
            ? parsed.filter((server): server is Server =>
                !!server
                && typeof server === 'object'
                && typeof (server as Server).id === 'string'
                && typeof (server as Server).name === 'string'
                && typeof (server as Server).address === 'string'
            )
            : [];
    } catch {
        return [];
    }
}

async function checkForNewNotifications() {
    if (running || AppState.currentState !== 'active') return;

    running = true;

    try {
        const servers = await loadServers();
        if (!servers.length) return;

        const savedSeen = await AsyncStorage.getItem(SEEN_KEY);
        const seen: Record<string, string[]> = savedSeen ? JSON.parse(savedSeen) : {};

        for (const server of servers) {
            try {
                const address = server.address.trim();
                if (!address) continue;

                const base = (address.startsWith('http') ? address : `http://${address}`).replace(/\/+$/, '');
                const apiKey = await SecureStore.getItemAsync(getApiKeyStorageKey(server.id));

                const response = await fetch(`${base}/notifications`, {
                    headers: {
                        Accept: 'application/json',
                        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
                    },
                });

                if (!response.ok) continue;

                const json: unknown = await response.json();
                if (!json || typeof json !== 'object') continue;

                const notifications = Array.isArray((json as { notifications?: unknown }).notifications)
                    ? (json as { notifications: unknown[] }).notifications.filter(
                        (item): item is Item => !!item && typeof item === 'object'
                    )
                    : [];

                const keys = notifications.map(notification => getItemKey(server.id, notification));
                const previous = new Set(seen[server.id] ?? []);

                // 앱을 처음 실행했을 때 기존 알림은 기준점으로만 저장합니다.
                if (!seen[server.id]) {
                    seen[server.id] = keys.slice(-200);
                    continue;
                }

                const newNotifications = notifications.filter(
                    notification => !previous.has(getItemKey(server.id, notification))
                );

                for (const notification of newNotifications) {
                    const picoName =
                        typeof notification.picoName === 'string' && notification.picoName
                            ? notification.picoName
                            : '센서';
                    const message =
                        typeof notification.message === 'string' && notification.message
                            ? notification.message
                            : '새로운 SmartFarm 알림이 도착했습니다.';

                    // Expo Go Android에서는 expo-notifications를 사용할 수 없으므로
                    // foreground 상태에서 앱 내부 알림으로 표시합니다.
                    Alert.alert(`${server.name} · ${picoName}`, message);
                }

                seen[server.id] = Array.from(
                    new Set([...previous, ...keys])
                ).slice(-200);
            } catch {
                // 한 서버의 오류가 다른 서버의 폴링을 중단시키지 않습니다.
            }
        }

        await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } finally {
        running = false;
    }
}

function startPolling() {
    if (timer) return;

    void checkForNewNotifications();
    timer = setInterval(() => {
        void checkForNewNotifications();
    }, INTERVAL);
}

function stopPolling() {
    if (!timer) return;

    clearInterval(timer);
    timer = null;
}

export function initializeNotificationForeground() {
    if (Platform.OS === 'web') return false;

    if (AppState.currentState === 'active') {
        startPolling();
    }

    return true;
}

export function subscribeNotificationForegroundPolling() {
    const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') {
            startPolling();
        } else {
            stopPolling();
        }
    });

    if (AppState.currentState === 'active') {
        startPolling();
    }

    return () => {
        subscription.remove();
        stopPolling();
    };
}
