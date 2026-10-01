import { SERVER_CONFIGS_STORAGE_KEY } from '@/constants/storageKeys';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import Constants from 'expo-constants';
import type { NotificationPermissionsStatus } from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const BACKGROUND_TASK_NAME = 'smartfarm-notification-poll';
const POLL_STATE_STORAGE_KEY = '@smartfarm/notification-poll-state';
const BACKGROUND_INTERVAL_STORAGE_KEY = '@smartfarm/notification-background-interval';
export const NOTIFICATION_CHANNEL_ID = 'smartfarm-alerts';
const MIN_BACKGROUND_INTERVAL_MINUTES = 15;
const DEFAULT_SERVER_INTERVAL_MINUTES = 5;
const MAX_REMEMBERED_IDS = 500;

type ServerConfig = { id: string; name?: string; address: string };
type ServerNotification = { id?: string | number; type?: string; message?: string; picoId?: string; createdAt?: string };
type ServerPollState = { lastCheckedAt: number; seenIds: string[] };
type NotificationPollState = Record<string, ServerPollState>;

let pollInFlight: Promise<number> | null = null;
let notificationsModule: typeof import('expo-notifications') | null = null;
let notificationHandlerConfigured = false;

const isAndroidExpoGo = Platform.OS === 'android'
    && (Boolean(Constants.expoGoConfig) || Constants.appOwnership === 'expo');

async function getNotificationsModule() {
    if (Platform.OS === 'web' || isAndroidExpoGo) return null;
    if (notificationsModule) return notificationsModule;
    try {
        notificationsModule = await import('expo-notifications');
        if (!notificationHandlerConfigured) {
            notificationsModule.setNotificationHandler({
                handleNotification: async () => ({
                    shouldPlaySound: true,
                    shouldSetBadge: true,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });
            notificationHandlerConfigured = true;
        }
        return notificationsModule;
    } catch {
        return null;
    }
}

if (Platform.OS !== 'web' && !isAndroidExpoGo) {
    TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ error }) => {
        if (error) return BackgroundTask.BackgroundTaskResult.Failed;
        try {
            await pollNotificationServers();
            return BackgroundTask.BackgroundTaskResult.Success;
        } catch {
            return BackgroundTask.BackgroundTaskResult.Failed;
        }
    });
}

function isPermissionGranted(permission: NotificationPermissionsStatus, provisionalStatus: number) {
    return permission.granted || permission.ios?.status === provisionalStatus;
}

export async function requestNotificationPermission() {
    if (Platform.OS === 'web') return false;
    const Notifications = await getNotificationsModule();
    if (!Notifications) return false;

    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
                name: '스마트팜 알림',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#22C55E',
            });
        }

        const current = await Notifications.getPermissionsAsync();
        if (isPermissionGranted(current, Notifications.IosAuthorizationStatus.PROVISIONAL)) return true;
        if (current.status !== 'undetermined' || !current.canAskAgain) return false;

        const requested = await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        return isPermissionGranted(requested, Notifications.IosAuthorizationStatus.PROVISIONAL);
    } catch {
        return false;
    }
}

async function loadServerConfigs(): Promise<ServerConfig[]> {
    const saved = await AsyncStorage.getItem(SERVER_CONFIGS_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ServerConfig =>
        item && typeof item.id === 'string' && typeof item.address === 'string',
    );
}

async function loadPollState(): Promise<NotificationPollState> {
    try {
        const saved = await AsyncStorage.getItem(POLL_STATE_STORAGE_KEY);
        if (!saved) return {};
        const parsed: unknown = JSON.parse(saved);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as NotificationPollState
            : {};
    } catch {
        return {};
    }
}

function getBaseUrl(server: ServerConfig) {
    const address = server.address.trim();
    return (address.startsWith('http') ? address : `http://${address}`).replace(/\/+$/, '');
}

async function getServerIntervalMinutes(server: ServerConfig) {
    try {
        const response = await fetch(`${getBaseUrl(server)}/settings`, { headers: { Accept: 'application/json' } });
        if (!response.ok) return DEFAULT_SERVER_INTERVAL_MINUTES;
        const json = await response.json();
        const value = Number(json?.settings?.syncIntervalMinutes);
        return Number.isInteger(value) && value >= 1 && value <= 1440 ? value : DEFAULT_SERVER_INTERVAL_MINUTES;
    } catch {
        return DEFAULT_SERVER_INTERVAL_MINUTES;
    }
}

async function getServerNotifications(server: ServerConfig): Promise<ServerNotification[]> {
    const response = await fetch(`${getBaseUrl(server)}/notifications`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Notifications request failed (${response.status})`);
    const json = await response.json();
    return Array.isArray(json?.notifications) ? json.notifications : [];
}

function getNotificationId(notification: ServerNotification) {
    return notification.id === undefined || notification.id === null ? '' : String(notification.id);
}

async function sendLocalNotification(server: ServerConfig, notification: ServerNotification, id: string) {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return false;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: `${server.name || '스마트팜'} · ${notification.picoId || '센서 알림'}`,
            body: notification.message || '새 알림이 도착했습니다.',
            data: { serverId: server.id, notificationId: id },
            sound: 'default',
        },
        trigger: null,
    });
    return true;
}

async function checkServer(server: ServerConfig, state: NotificationPollState, now: number) {
    const intervalMinutes = await getServerIntervalMinutes(server);
    const previous = state[server.id];

    if (!previous) {
        const notifications = await getServerNotifications(server);
        const ids = notifications.map(getNotificationId).filter(Boolean);
        state[server.id] = { lastCheckedAt: now, seenIds: ids.slice(-MAX_REMEMBERED_IDS) };
        return intervalMinutes;
    }

    if (now - previous.lastCheckedAt < intervalMinutes * 60_000) return intervalMinutes;

    const notifications = await getServerNotifications(server);
    const seen = new Set(previous.seenIds);
    for (const notification of notifications) {
        const id = getNotificationId(notification);
        if (!id || seen.has(id)) continue;
        try {
            if (await sendLocalNotification(server, notification, id)) seen.add(id);
        } catch {
            // Keep failed deliveries unseen so a later poll can retry them.
        }
    }

    state[server.id] = {
        lastCheckedAt: now,
        seenIds: Array.from(seen).slice(-MAX_REMEMBERED_IDS),
    };
    return intervalMinutes;
}

async function runNotificationPoll(servers?: ServerConfig[]) {
    const configuredServers = servers ?? await loadServerConfigs();
    const state = await loadPollState();
    const now = Date.now();
    const intervals = await Promise.all(configuredServers.map(async server => {
        try {
            return await checkServer(server, state, now);
        } catch {
            return DEFAULT_SERVER_INTERVAL_MINUTES;
        }
    }));
    await AsyncStorage.setItem(POLL_STATE_STORAGE_KEY, JSON.stringify(state));
    return intervals.length ? Math.min(...intervals) : DEFAULT_SERVER_INTERVAL_MINUTES;
}

export function pollNotificationServers(servers?: ServerConfig[]) {
    if (pollInFlight) return pollInFlight;
    pollInFlight = runNotificationPoll(servers).finally(() => { pollInFlight = null; });
    return pollInFlight;
}

export async function syncBackgroundNotificationTask(enabled: boolean, minimumIntervalMinutes: number) {
    if (Platform.OS === 'web' || isAndroidExpoGo) return;

    const isAvailable = await TaskManager.isAvailableAsync();
    if (!isAvailable) return;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    const status = await BackgroundTask.getStatusAsync();
    if (!enabled || status !== BackgroundTask.BackgroundTaskStatus.Available) {
        if (isRegistered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_NAME);
        await AsyncStorage.removeItem(BACKGROUND_INTERVAL_STORAGE_KEY);
        return;
    }

    const minimumInterval = Math.max(MIN_BACKGROUND_INTERVAL_MINUTES, Math.ceil(minimumIntervalMinutes));
    const registeredInterval = await AsyncStorage.getItem(BACKGROUND_INTERVAL_STORAGE_KEY);
    if (isRegistered && registeredInterval === String(minimumInterval)) return;
    if (isRegistered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_NAME);
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, { minimumInterval });
    await AsyncStorage.setItem(BACKGROUND_INTERVAL_STORAGE_KEY, String(minimumInterval));
}