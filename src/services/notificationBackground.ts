import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const BACKGROUND_NOTIFICATION_TASK = 'smartfarm-notification-background-task';
const SERVER_STORAGE_KEY = '@smartfarm/server-configs';
const SEEN_STORAGE_KEY = '@smartfarm/background-notification-seen';
const API_KEY_PREFIX = 'smartfarm-api-key-';
const ANDROID_CHANNEL_ID = 'smartfarm-alerts';

type ServerConfig = {
    id: string;
    name: string;
    description: string;
    address: string;
};

type RawNotification = {
    id?: string | number;
    type?: unknown;
    level?: unknown;
    message?: unknown;
    picoId?: unknown;
    picoName?: unknown;
    createdAt?: unknown;
};

function getApiKeyStorageKey(id: string) {
    const safeId = id.replace(/[^A-Za-z0-9._-]/g, '_');
    return safeId ? `${API_KEY_PREFIX}${safeId}` : '';
}

function getNotificationKey(serverId: string, notification: RawNotification) {
    if (notification.id !== undefined && notification.id !== null) {
        return `${serverId}:${String(notification.id)}`;
    }

    return [
        serverId,
        typeof notification.createdAt === 'string' ? notification.createdAt : '',
        typeof notification.picoId === 'string' ? notification.picoId : '',
        typeof notification.message === 'string' ? notification.message : '',
    ].join(':');
}

function getNotificationText(notification: RawNotification) {
    return typeof notification.message === 'string' && notification.message
        ? notification.message
        : '새로운 SmartFarm 알림이 도착했습니다.';
}

function getNotificationTitle(server: ServerConfig, notification: RawNotification) {
    const picoName = typeof notification.picoName === 'string' && notification.picoName
        ? notification.picoName
        : '센서';

    return `${server.name} · ${picoName}`;
}

async function loadServers(): Promise<ServerConfig[]> {
    try {
        const saved = await AsyncStorage.getItem(SERVER_STORAGE_KEY);
        if (!saved) return [];

        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((item): item is ServerConfig =>
            !!item
            && typeof item === 'object'
            && typeof (item as ServerConfig).id === 'string'
            && typeof (item as ServerConfig).name === 'string'
            && typeof (item as ServerConfig).description === 'string'
            && typeof (item as ServerConfig).address === 'string'
        );
    } catch {
        return [];
    }
}

async function loadSeenNotifications(): Promise<Record<string, string[]>> {
    try {
        const saved = await AsyncStorage.getItem(SEEN_STORAGE_KEY);
        if (!saved) return {};

        const parsed: unknown = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

        return parsed as Record<string, string[]>;
    } catch {
        return {};
    }
}

async function saveSeenNotifications(seen: Record<string, string[]>) {
    await AsyncStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seen));
}

async function getServerNotifications(server: ServerConfig): Promise<RawNotification[]> {
    const address = server.address.trim();
    if (!address) return [];

    const base = (address.startsWith('http') ? address : `http://${address}`).replace(/\\/+$/, '');
    const apiKeyKey = getApiKeyStorageKey(server.id);
    const apiKey = apiKeyKey ? await (await import('expo-secure-store')).getItemAsync(apiKeyKey) : null;

    const response = await fetch(`${base}/notifications`, {
        headers: {
            Accept: 'application/json',
            ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
    });

    if (!response.ok) return [];

    const json: unknown = await response.json();
    if (!json || typeof json !== 'object') return [];

    const notifications = (json as { notifications?: unknown }).notifications;
    return Array.isArray(notifications)
        ? notifications.filter((item): item is RawNotification => !!item && typeof item === 'object')
        : [];
}

async function checkForNewNotifications() {
    const servers = await loadServers();
    if (!servers.length) return false;

    const seen = await loadSeenNotifications();
    let hasNewData = false;

    for (const server of servers) {
        let notifications: RawNotification[] = [];

        try {
            notifications = await getServerNotifications(server);
        } catch {
            continue;
        }

        const keys = notifications.map(notification => getNotificationKey(server.id, notification));
        const previous = new Set(seen[server.id] ?? []);

        // The first background check for a server establishes a baseline.
        // Existing notifications should not suddenly generate a burst of alerts.
        if (!seen[server.id]) {
            seen[server.id] = keys.slice(-200);
            hasNewData = true;
            continue;
        }

        const newNotifications = notifications.filter(notification =>
            !previous.has(getNotificationKey(server.id, notification))
        );

        for (const notification of newNotifications) {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: getNotificationTitle(server, notification),
                    body: getNotificationText(notification),
                    sound: 'default',
                    data: {
                        serverId: server.id,
                        picoId: typeof notification.picoId === 'string' ? notification.picoId : '',
                    },
                },
                trigger: null,
            });
        }

        if (newNotifications.length > 0) hasNewData = true;
        seen[server.id] = [...new Set([...previous, ...keys])].slice(-200);
    }

    await saveSeenNotifications(seen);
    return hasNewData;
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
    try {
        await checkForNewNotifications();
        return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
});

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

async function configureNotificationChannel() {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'SmartFarm 알림',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
    });
}

export async function initializeNotificationBackground() {
    if (Platform.OS === 'web') return false;

    await configureNotificationChannel();

    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted
        ? current
        : await Notifications.requestPermissionsAsync({
            ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
            },
        });

    if (!permission.granted) return false;

    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;

    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!registered) {
        await BackgroundTask.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
            minimumInterval: 15,
        });
    }

    return true;
}

export async function triggerNotificationBackgroundTaskForTesting() {
    if (__DEV__ && Platform.OS !== 'web') {
        return BackgroundTask.triggerTaskWorkerForTestingAsync();
    }

    return false;
}
