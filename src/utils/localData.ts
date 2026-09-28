import AsyncStorage from '@react-native-async-storage/async-storage';

const snapshotKey = (serverId: string) => `@smartfarm/state/${serverId}`;

export async function saveServerSnapshot(serverId: string, state: unknown) {
    await AsyncStorage.setItem(snapshotKey(serverId), JSON.stringify({ savedAt: new Date().toISOString(), state }));
}

export async function loadServerSnapshot<T>(serverId: string): Promise<{ savedAt: string; state: T } | null> {
    const value = await AsyncStorage.getItem(snapshotKey(serverId));
    if (!value) return null;
    try {
        const cached = JSON.parse(value);
        if (typeof cached?.savedAt === 'string' && cached.state) return cached;
    } catch {
        // A corrupt cache is treated as absent; the next successful sync replaces it.
    }
    return null;
}

export async function clearServerSnapshot(serverId: string) {
    await AsyncStorage.removeItem(snapshotKey(serverId));
}
