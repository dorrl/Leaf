import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors } from '@/constants/Colors';
import { useServerAddress } from '@/hooks/useServerAddress';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';

type NotificationType = 'warning' | 'info' | 'error';
type NotificationItem = {
    id: string;
    type: NotificationType;
    message: string;
    picoId: string;
    picoName: string;
    serverId: string;
    serverName: string;
    createdAt: string;
    resolved: boolean;
};
type RawNotification = {
    id?: string | number;
    type?: unknown;
    level?: unknown;
    message?: unknown;
    picoId?: unknown;
    picoName?: unknown;
    createdAt?: unknown;
    resolved?: unknown;
};

function NotificationRow({ item, isDark, showServerName }: { item: NotificationItem; isDark: boolean; showServerName: boolean }) {
    const router = useRouter();
    const c = isDark ? Colors.dark : Colors.light;
    const palette = item.type === 'error' ? c.red : item.type === 'warning' ? c.orange : c.blue;
    const icon: keyof typeof Ionicons.glyphMap = item.type === 'error' ? 'close-circle-outline' : item.type === 'warning' ? 'warning-outline' : 'information-circle-outline';
    const typeLabel = item.type === 'error' ? '오류' : item.type === 'warning' ? '주의' : '안내';
    const timestamp = Date.parse(item.createdAt);
    const time = Number.isFinite(timestamp)
        ? new Date(timestamp).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

    return <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.serverName}, ${item.picoName}, ${typeLabel}. ${item.message}`}
        onPress={() => {
            if (!item.picoId) return;
            router.push({ pathname: '/server/[id]/[pico]', params: { id: item.serverId, pico: item.picoId } });
        }}
        style={({ pressed }) => ({ backgroundColor: pressed ? c.sub.cover : 'transparent' })}
    >
        <View style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.main.outline, gap: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.cover, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={18} color={palette.text} />
            </View>
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: c.main.text }} numberOfLines={1}>{item.picoName}</Text>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.subText }} />
                    <Text style={{ fontFamily: 'Pretendard-Medium', fontSize: 12, color: palette.text }}>{typeLabel}</Text>
                </View>
                <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: 13, color: c.subText, marginTop: 3 }} numberOfLines={1}>{item.message}</Text>
                {showServerName && <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: 11, color: c.subText, marginTop: 3 }} numberOfLines={1}>{item.serverName}</Text>}
            </View>
            {item.resolved && <Text style={{ fontFamily: 'Pretendard-Medium', fontSize: 11, color: c.green.text }}>해결됨</Text>}
            <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: 11, color: c.subText, minWidth: 72, textAlign: 'right' }}>{time}</Text>
            <Ionicons name="chevron-forward" size={16} color={c.subText} />
        </View>
    </Pressable>;
}

export default function Notifications() {
    const { width } = useWindowDimensions();
    const isWideLayout = width >= 820;
    const { isDark } = useTheme();
    const c = isDark ? Colors.dark : Colors.light;
    const { servers, getServerApiKey } = useServerAddress();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const responses = await Promise.all(servers.map(async server => {
            const address = server.address.trim();
            const base = (address.startsWith('http') ? address : `http://${address}`).replace(/\/+$/, '');
            try {
                const [notificationsResponse, stateResponse] = await Promise.all([
                    fetch(`${base}/notifications`, { headers: { Accept: 'application/json' } }),
                    fetch(`${base}/state`, { headers: { Accept: 'application/json' } }).catch(() => null),
                ]);
                if (!notificationsResponse.ok) return [];
                const [notificationsJson, stateJson] = await Promise.all([
                    notificationsResponse.json(),
                    stateResponse?.ok ? stateResponse.json() : Promise.resolve(null),
                ]);
                const picoNames = new Map<string, string>();
                if (Array.isArray(stateJson?.pico)) {
                    for (const pico of stateJson.pico) {
                        if (typeof pico?.id === 'string') picoNames.set(pico.id, typeof pico.name === 'string' ? pico.name : pico.id);
                    }
                }
                const notifications: unknown[] = Array.isArray(notificationsJson?.notifications) ? notificationsJson.notifications : [];
                return notifications.flatMap((raw): NotificationItem[] => {
                    if (!raw || typeof raw !== 'object') return [];
                    const notification = raw as RawNotification;
                    const picoId = typeof notification.picoId === 'string' ? notification.picoId : '';
                    const rawType = notification.level ?? notification.type;
                    const type: NotificationType = rawType === 'error' || rawType === 'warning' || rawType === 'info' ? rawType : 'info';
                    return [{
                        id: notification.id ? String(notification.id) : `${server.id}-${notification.createdAt ?? ''}-${picoId}`,
                        type,
                        message: typeof notification.message === 'string' ? notification.message : '새 알림이 도착했습니다.',
                        picoId,
                        picoName: typeof notification.picoName === 'string' ? notification.picoName : (picoNames.get(picoId) ?? picoId) || '센서',
                        serverId: server.id,
                        serverName: server.name,
                        createdAt: typeof notification.createdAt === 'string' ? notification.createdAt : '',
                        resolved: notification.resolved === true,
                    }];
                });
            } catch { return []; }
        }));
        setItems(responses.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
        setRefreshing(false);
    }, [servers]);

    const activeServerId = servers.some(server => server.id === selectedServerId) ? selectedServerId : null;
    const visibleItems = activeServerId ? items.filter(item => item.serverId === activeServerId) : items;
    const selectedServer = servers.find(server => server.id === activeServerId);
    const serverCounts = items.reduce<Record<string, number>>((counts, item) => {
        counts[item.serverId] = (counts[item.serverId] ?? 0) + 1;
        return counts;
    }, {});

    const renderServerFilter = (serverId: string | null, label: string, count: number) => {
        const selected = activeServerId === serverId;
        return <Pressable
            key={serverId ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setSelectedServerId(serverId)}
            style={{ minHeight: 38, alignSelf: isWideLayout ? 'stretch' : 'flex-start', minWidth: isWideLayout ? undefined : 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: selected ? c.accent : c.main.outline, backgroundColor: selected ? c.sub.cover : c.main.cover }}
        >
            <Text style={{ fontFamily: selected ? 'Pretendard-SemiBold' : 'Pretendard-Medium', fontSize: 13, color: selected ? c.main.text : c.subText, marginRight: 10 }} numberOfLines={1}>{label}</Text>
            <Text style={{ fontFamily: 'Pretendard-Medium', fontSize: 11, color: selected ? c.main.text : c.subText }}>{count}</Text>
        </Pressable>;
    };

    const deleteNotifications = async () => {
        setDeleteModalVisible(false);
        setDeleting(true);
        try {
            await Promise.all(servers.map(async server => {
                try {
                    const apiKey = await getServerApiKey(server.id);
                    if (!apiKey) return;
                    const address = server.address.trim();
                    const base = address.startsWith('http') ? address : `http://${address}`;
                    await fetch(`${base.replace(/\/+$/, '')}/notifications/delete`, {
                        method: 'DELETE',
                        headers: { Accept: 'application/json', 'X-API-Key': apiKey },
                    });
                } catch {
                    // A failed server should not block deletion requests to other servers.
                }
            }));
            await load();
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        let active = true;
        void Promise.resolve().then(() => {
            if (active) void load();
        });
        return () => { active = false; };
    }, [load]);
    return <View style={{ flex: 1, flexDirection: isWideLayout ? 'row' : 'column', backgroundColor: c.background }}>
        {isWideLayout && <View style={{ width: 216, paddingHorizontal: 12, paddingTop: 24, borderRightWidth: 1, borderRightColor: c.main.outline, backgroundColor: c.main.cover }}>
            <Text style={{ paddingHorizontal: 10, paddingBottom: 10, fontFamily: 'Pretendard-Bold', fontSize: 12, color: c.subText }}>서버</Text>
            {renderServerFilter(null, '모든 서버', items.length)}
            <View style={{ height: 1, backgroundColor: c.main.outline, marginVertical: 10 }} />
            {servers.map(server => renderServerFilter(server.id, server.name, serverCounts[server.id] ?? 0))}
        </View>}
        <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: isWideLayout ? 28 : 16, paddingTop: isWideLayout ? 24 : 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: 23, color: c.main.text }}>알림</Text>
                    <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: 12, color: c.subText, marginTop: 3 }}>
                        {selectedServer?.name ?? '모든 서버'} · {visibleItems.length}개
                    </Text>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="전체 알림 삭제"
                    disabled={deleting || items.length === 0}
                    onPress={() => setDeleteModalVisible(true)}
                    style={({ pressed }) => ({ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: pressed ? c.red.cover : 'transparent', opacity: deleting || items.length === 0 ? 0.4 : 1 })}
                >
                    {deleting ? <ActivityIndicator size="small" color={c.red.text} /> : <Ionicons name="trash-outline" size={18} color={c.red.text} />}
                </Pressable>
            </View>
            {!isWideLayout && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
                {renderServerFilter(null, '모든 서버', items.length)}
                {servers.map(server => renderServerFilter(server.id, server.name, serverCounts[server.id] ?? 0))}
            </ScrollView>}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: isWideLayout ? 16 : 8, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={c.accent} />}
            >
                {loading ? <ActivityIndicator color={c.accent} style={{ marginTop: 32 }} /> : visibleItems.length ? visibleItems.map(item => <NotificationRow key={`${item.serverId}-${item.id}`} item={item} isDark={isDark} showServerName={!activeServerId} />) : <Text style={{ padding: 18, fontFamily: 'Pretendard-Regular', color: c.subText }}>{items.length ? '이 서버에는 알림이 없습니다.' : '현재 알림이 없습니다.'}</Text>}
            </ScrollView>
        </View>
        <ConfirmModal
            visible={deleteModalVisible}
            title="알림 전체 삭제"
            message="등록된 서버들의 저장된 알림을 모두 삭제할까요?"
            confirmLabel="삭제"
            destructive
            onCancel={() => setDeleteModalVisible(false)}
            onConfirm={() => void deleteNotifications()}
            c={c}
        />
    </View>;
}
