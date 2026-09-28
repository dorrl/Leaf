import { Colors } from '@/constants/Colors';
import { useServerAddress } from '@/hooks/useServerAddress';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
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
    const { servers } = useServerAddress();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    useEffect(() => { void load(); }, [load]);
    return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: wide * 5, paddingBottom: wide * 22 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={c.accent} />}>
        <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: wide * 7, color: c.main.text, marginBottom: wide * 5 }}>알림</Text>
        {loading ? <ActivityIndicator color={c.accent} /> : items.length ? items.map(item => <NotificationCard key={item.id} item={item} wide={wide} isDark={isDark} />) : <Text style={{ fontFamily: 'Pretendard-Regular', color: c.subText }}>현재 알림이 없습니다.</Text>}
    </ScrollView>;
}
