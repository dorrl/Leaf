import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

const STORAGE_KEY = '@smartfarm/server-configs';
const SEEN_KEY = '@smartfarm/notification-seen';
const PERMISSION_REQUESTED_KEY = '@smartfarm/notification-permission-requested';
const API_PREFIX = 'smartfarm-api-key-';
const BACKGROUND_TASK_NAME = 'smartfarm-notification-check';
const FOREGROUND_INTERVAL = 30_000;
const BACKGROUND_INTERVAL_MINUTES = 15;
const NOTIFICATION_CHANNEL = 'smartfarm-alerts';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

type Server = { id: string; name: string; address: string };
type Item = { id?: string | number; message?: unknown; picoId?: unknown; picoName?: unknown; createdAt?: unknown };

const getApiKeyStorageKey = (id: string) => {
    const safeId = id.replace(/[^A-Za-z0-9._-]/g, '_');
    return safeId ? `${API_PREFIX}${safeId}` : '';
};

const getItemKey = (serverId: string, notification: Item) =>
    notification.id !== undefined && notification.id !== null
        ? `${serverId}:${String(notification.id)}`
        : [serverId, notification.createdAt ?? '', notification.picoId ?? '', notification.message ?? ''].join(':');

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

async function fetchNewNotifications(): Promise<Array<{ server: Server; notifications: Item[] }>> {
    const servers = await loadServers();
    if (!servers.length) return [];

    const savedSeen = await AsyncStorage.getItem(SEEN_KEY);
    const seen: Record<string, string[]> = savedSeen ? JSON.parse(savedSeen) : {};
    const changes: Array<{ server: Server; notifications: Item[] }> = [];

    for (const server of servers) {
        try {
            const address = server.address.trim();
            if (!address) continue;
            const base = (address.startsWith('http') ? address : `http://${address}`).replace(/\/+$/, '');
            const apiKey = await SecureStore.getItemAsync(getApiKeyStorageKey(server.id));
            const response = await fetch(`${base}/notifications`, {
                headers: { Accept: 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
            });
            if (!response.ok) continue;

            const json: unknown = await response.json();
            if (!json || typeof json !== 'object') continue;
            const notifications = Array.isArray((json as { notifications?: unknown }).notifications)
                ? (json as { notifications: unknown[] }).notifications.filter(
                    (item): item is Item => !!item && typeof item === 'object')
                : [];

            const keys = notifications.map(notification => getItemKey(server.id, notification));
            const previous = new Set(seen[server.id] ?? []);

            if (!seen[server.id]) {
                seen[server.id] = keys.slice(-200);
                continue;
            }

            const newNotifications = notifications.filter(
                notification => !previous.has(getItemKey(server.id, notification)));

            if (newNotifications.length > 0) changes.push({ server, notifications: newNotifications });
            seen[server.id] = Array.from(new Set([...previous, ...keys])).slice(-200);
        } catch {
            // 한 서버의 오류가 다른 서버의 확인을 중단시키지 않습니다.
        }
    }

    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    return changes;
}

async function showSystemNotifications() {
    if (running) return;
    running = true;
    try {
        const changes = await fetchNewNotifications();
        for (const { server, notifications } of changes) {
            const latest = notifications[notifications.length - 1];
            const picoName = typeof latest?.picoName === 'string' && latest.picoName ? latest.picoName : '센서';
            const latestMessage = typeof latest?.message === 'string' && latest.message
                ? latest.message
                : '새로운 SmartFarm 알림이 도착했습니다.';
            const body = notifications.length > 1
                ? `${latestMessage} (새 알림 ${notifications.length}개)`
                : latestMessage;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: `${server.name} · ${picoName}`,
                    body,
                    data: { serverId: server.id, picoId: latest?.picoId ?? null },
                },
                trigger: null,
            });
        }
    } finally {
        running = false;
    }
}

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
    try {
        await showSystemNotifications();
        return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
});

async function registerBackgroundTask() {
    if (Platform.OS === 'web') return;
    try {
        const status = await BackgroundTask.getStatusAsync();
        if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

        const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
        if (!registered) {
            await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
                minimumInterval: BACKGROUND_INTERVAL_MINUTES,
            });
        }
    } catch {
        // 백그라운드 작업을 사용할 수 없는 환경에서는 foreground polling만 사용합니다.
    }
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

function startPolling() {
    if (timer) return;
    void showSystemNotifications();
    timer = setInterval(() => { void showSystemNotifications(); }, FOREGROUND_INTERVAL);
}

function stopPolling() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
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

    await registerBackgroundTask();
    return true;
}

export function startNotificationForegroundPolling() {
    if (Platform.OS !== 'web' && AppState.currentState === 'active') startPolling();
}

export function subscribeNotificationForegroundPolling() {
    const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') startPolling();
        else stopPolling();
    });

    if (AppState.currentState === 'active') startPolling();

    return () => {
        subscription.remove();
        stopPolling();
    };
}
