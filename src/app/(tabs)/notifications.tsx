import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors } from '@/constants/Colors';
import { useServerAddress } from '@/hooks/useServerAddress';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type NotificationItem = { id: string; type: 'warning' | 'info' | 'error'; message: string; picoId: string; createdAt: string; resolved: boolean };

function NotificationCard({ item, wide, isDark }: { item: NotificationItem; wide: number; isDark: boolean }) {
    const c = isDark ? Colors.dark : Colors.light;
    const palette = item.type === 'error' ? c.red : item.type === 'warning' ? c.orange : c.blue;
    const icon: keyof typeof Ionicons.glyphMap = item.type === 'error' ? 'close-circle-outline' : item.type === 'warning' ? 'warning-outline' : 'information-circle-outline';
    const opacity = useSharedValue(0);
    useEffect(() => { opacity.value = withTiming(1, { duration: 250 }); }, [opacity]);
    const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const time = new Date(item.createdAt).toLocaleString('ko-KR');

    return <Animated.View style={[animated, { flexDirection: 'row', backgroundColor: c.main.cover, borderRadius: wide * 4, padding: wide * 4, marginBottom: wide * 3, borderWidth: 1, borderColor: c.main.outline }]}>
        <View style={{ width: wide * 10, height: wide * 10, borderRadius: wide * 2.5, backgroundColor: palette.cover, alignItems: 'center', justifyContent: 'center', marginRight: wide * 3 }}>
            <Ionicons name={icon} size={wide * 5} color={palette.text} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Pretendard-SemiBold', fontSize: wide * 3.5, color: c.main.text }}>{item.picoId}</Text>
            <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: wide * 3, color: c.subText, marginTop: wide }}>{item.message}</Text>
            <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: wide * 2.4, color: c.subText, marginTop: wide }}>{time}{item.resolved ? ' · 해결됨' : ''}</Text>
        </View>
    </Animated.View>;
}

export default function Notifications() {
    const { width, height } = useWindowDimensions();
    const wide = Math.min(width, height) * 0.01;
    const { isDark } = useTheme();
    const c = isDark ? Colors.dark : Colors.light;
    const { servers, getServerApiKey } = useServerAddress();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        const responses = await Promise.all(servers.map(async server => {
            const base = server.address.startsWith('http') ? server.address : `http://${server.address}`;
            try {
                const response = await fetch(`${base}/notifications`, { headers: { Accept: 'application/json' } });
                if (!response.ok) return [];
                const json = await response.json();
                return Array.isArray(json.notifications) ? json.notifications : [];
            } catch { return []; }
        }));
        setItems(responses.flat().sort((a: NotificationItem, b: NotificationItem) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
        setRefreshing(false);
    }, [servers]);

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
    return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: wide * 5, paddingBottom: wide * 22 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={c.accent} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: wide * 5 }}>
            <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: wide * 7, color: c.main.text }}>알림</Text>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="전체 알림 삭제"
                disabled={deleting || items.length === 0}
                onPress={() => setDeleteModalVisible(true)}
                style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: c.red.cover, opacity: deleting || items.length === 0 ? 0.5 : 1 }}
            >
                {deleting ? <ActivityIndicator size="small" color={c.red.text} /> : <Ionicons name="trash-outline" size={wide * 4} color={c.red.text} />}
                <Text style={{ fontFamily: 'Pretendard-SemiBold', fontSize: wide * 2.8, color: c.red.text }}>{deleting ? '삭제 중...' : '전체 삭제'}</Text>
            </Pressable>
        </View>
        {loading ? <ActivityIndicator color={c.accent} /> : items.length ? items.map(item => <NotificationCard key={item.id} item={item} wide={wide} isDark={isDark} />) : <Text style={{ fontFamily: 'Pretendard-Regular', color: c.subText }}>현재 알림이 없습니다.</Text>}
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
    </ScrollView>;
}
