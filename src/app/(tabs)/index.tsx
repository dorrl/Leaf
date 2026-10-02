import { Colors } from '@/constants/Colors';
import { useServerAddress } from '@/hooks/useServerAddress';
import { useTheme } from '@/hooks/useTheme';
import type { PicoStatus } from '@/types/pico';
import { formatSensorValue } from '@/utils/formatSensorValue';
import { loadServerSnapshot, saveServerSnapshot } from '@/utils/localData';
import { getPicoStatus } from '@/utils/pico';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pico {
    name: string;
    temp?: number;
    humidity?: number;
    light?: number;
    status: PicoStatus;
}

interface Server {
    id: string;
    name: string;
    location: string;
    picos: Pico[];
    loading?: boolean;
    error?: boolean;
    address?: string;
    syncIntervalMinutes?: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniPicoCard({ pico, isServerDark, wide }: { pico: Pico; isServerDark: boolean; wide: number }) {
    const c = isServerDark ? Colors.dark : Colors.light;
    const statusColor = pico.status === 'normal' ? c.green : pico.status === 'wrong' ? c.red : c.sub;
    const lightValueColor = c.orange.text;
    const dotStyle = {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: statusColor.text,
    };

    return (
        <View style={[
            styles.miniPico,
            {
                backgroundColor: c.main.cover,
                width: '24%',
                minHeight: 72,
                padding: 8,
                borderRadius: 6,
                borderColor: c.main.outline,
                borderWidth: 1,
                },
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: wide * 0.8 }}>
                <Text style={[styles.miniPicoName, { color: c.main.text, fontSize: 11 }]} numberOfLines={1}>
                    {pico.name}
                </Text>
                {pico.status !== 'disconnected' && <View style={dotStyle} />}
            </View>

            {pico.status !== 'disconnected' ? (
                <View style={{ gap: 3 }}>
                    <View style={styles.miniValRow}>
                        <Ionicons name="thermometer-outline" size={12} color={c.subText} />
                        <Text style={[styles.miniPicoTxt, { color: c.main.text, fontSize: 11 }]}>{formatSensorValue(pico.temp)}°C</Text>
                    </View>
                    <View style={styles.miniValRow}>
                        <Ionicons name="water-outline" size={12} color={c.subText} />
                        <Text style={[styles.miniPicoTxt, { color: c.main.text, fontSize: 11 }]}>{formatSensorValue(pico.humidity)}%</Text>
                    </View>
                    <View style={styles.miniValRow}>
                        <Ionicons name="sunny-outline" size={12} color={lightValueColor} />
                        <Text style={[styles.miniPicoTxt, { color: lightValueColor, fontSize: 11, fontFamily: 'Pretendard-Bold' }]} numberOfLines={1}>
                            {formatSensorValue(pico.light)} lx
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="cloud-offline-outline" size={12} color={c.subText} />
                    <Text style={{ color: c.subText, fontSize: 10, fontFamily: 'Pretendard-Regular' }}>
                        오프라인
                    </Text>
                </View>
            )}
        </View>
    );
}

function ServerCard({ server, wide, isDarkTheme, wideLayout, onConfigure }: {
    server: Server;
    wide: number;
    isDarkTheme: boolean;
    wideLayout: boolean;
    onConfigure: () => void;
}) {
    const router = useRouter();
    const scale = useSharedValue(1);

    const isDark = isDarkTheme;
    const c = isDark ? Colors.dark : Colors.light;

    const cardBg = c.main.cover;
    const cardBorder = server.error
        ? c.red.outline
        : c.main.outline;

    const titleColor = c.main.text;
    const locationColor = c.subText;

    const pressHandler = () => {
        scale.value = withSpring(0.98, { damping: 15 }, () => {
            scale.value = withSpring(1, { damping: 15 });
        });
        router.push({ pathname: '/server/[id]', params: { id: server.id } });
    };

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const statusCounts = server.picos.reduce(
        (acc, p) => {
            if (p.status === 'normal') acc.normal++;
            else if (p.status === 'wrong') acc.wrong++;
            else acc.offline++;
            return acc;
        },
        { normal: 0, wrong: 0, offline: 0 }
    );

    return (
        <Pressable onPress={pressHandler} style={{ width: wideLayout ? '49%' : '100%' }}>
            <Animated.View style={[
                animStyle,
                styles.serverCard,
                {
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                    borderRadius: 8,
                    padding: 14,
                    shadowOpacity: 0,
                    elevation: 0,
                    borderWidth: server.error ? 1.5 : 1,
                }
            ]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: wide * 4 }}>
                    <View style={{ flex: 1, marginRight: wide * 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.serverTitle, { color: titleColor, fontSize: wide * 5.2 }]} numberOfLines={1}>
                                {server.name}
                            </Text>
                            {server.error && (
                                <View style={styles.errorDotBadge}>
                                    <Text style={{ fontSize: wide * 2, color: '#FFFFFF', fontFamily: 'Pretendard-Bold' }}>OFF</Text>
                                </View>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: wide * 0.8 }}>
                            <Ionicons name="location-outline" size={wide * 3.2} color={locationColor} style={{ marginRight: wide * 1 }} />
                            <Text style={{ fontFamily: 'Pretendard-Medium', fontSize: wide * 2.8, color: locationColor }} numberOfLines={1}>
                                {server.location}
                            </Text>
                        </View>
                    </View>

                    {/* Status summary & Configure Action button inside server header */}
                    <View style={{ flexDirection: 'row', gap: wide * 1.5, alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', gap: wide * 1.5 }}>
                            <View style={[styles.statusTag, { backgroundColor: c.green.cover }]}>
                                <Text style={{ color: c.green.text, fontSize: 11, fontFamily: 'Pretendard-Bold' }}>
                                    {statusCounts.normal}
                                </Text>
                            </View>
                            {statusCounts.wrong > 0 && (
                                <View style={[styles.statusTag, { backgroundColor: c.red.cover }]}>
                                    <Text style={{ color: c.red.text, fontSize: 11, fontFamily: 'Pretendard-Bold' }}>
                                        {statusCounts.wrong}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <Pressable
                            onPress={(e) => {
                                e.stopPropagation();
                                onConfigure();
                            }}
                            style={({ pressed }) => [
                                styles.gearBtn,
                                {
                                    backgroundColor: pressed
                                        ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
                                        : 'transparent',
                                }
                            ]}
                        >
                            <Ionicons name="settings-sharp" size={wide * 5.2} color={isDark ? '#94A3B8' : '#64748B'} />
                        </Pressable>
                    </View>
                </View>

                {/* Grid of mini picos */}
                <View style={styles.grid}>
                    {server.picos.map((pico, idx) => (
                        <MiniPicoCard key={idx} pico={pico} isServerDark={isDark} wide={wide} />
                    ))}
                </View>
            </Animated.View>
        </Pressable>
    );
}

// ─── Main Index Dashboard ─────────────────────────────────────────────────────

export default function Index() {
    const { width, height } = useWindowDimensions();
    const wide = Math.min(Math.min(width, height) * 0.01, 4);
    const wideLayout = width >= 760;
    const { isDark } = useTheme();
    const c = isDark ? Colors.dark : Colors.light;
    const router = useRouter();

    const { servers } = useServerAddress();
    const [fetchedServers, setFetchedServers] = useState<Server[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [pollIntervalMinutes, setPollIntervalMinutes] = useState(5);

    const loadData = useCallback(async () => {
        const loaded: Server[] = await Promise.all(
            servers.map(async (srv) => {
                try {
                    const formattedUrl = srv.address.startsWith('http') ? srv.address : `http://${srv.address}`;
                    const [res, settingsRes] = await Promise.all([
                        fetch(`${formattedUrl}/state`, {
                            headers: { 'Accept': 'application/json' },
                        }),
                        fetch(`${formattedUrl}/settings`, {
                            headers: { 'Accept': 'application/json' },
                        }).catch(() => null),
                    ]);
                    if (!res.ok) throw new Error('Network error');
                    const data = await res.json();
                    void saveServerSnapshot(srv.id, data);
                    const serverSettings = settingsRes?.ok ? await settingsRes.json() : null;
                    const syncIntervalMinutes = Number(serverSettings?.settings?.syncIntervalMinutes) || 5;

                    const picosList: Pico[] = (data.pico || []).map((p: any) => {
                        const status = getPicoStatus({
                            connected: p.connected,
                            temperature: p.state.temperature,
                            moisture: p.state.moisture,
                            light: p.state.light,
                            at: p.receivedAt ? Date.parse(p.receivedAt) : null,
                        }, p.optimalRange);
                        return {
                            name: p.name || p.id,
                            temp: p.state.temperature,
                            humidity: p.state.moisture,
                            light: p.state.light,
                            status,
                        };
                    });

                    return {
                        id: srv.id,
                        name: srv.name,
                        location: srv.description,
                        picos: picosList,
                        error: false,
                        address: srv.address,
                        syncIntervalMinutes,
                    };
                } catch {
                    const cached = await loadServerSnapshot<{ pico?: any[] }>(srv.id);
                    const picosList: Pico[] = (cached?.state.pico ?? []).map((p: any) => ({
                        name: p.name || p.id,
                        temp: p.state?.temperature,
                        humidity: p.state?.moisture,
                        light: p.state?.light,
                        status: getPicoStatus({
                            connected: p.connected,
                            temperature: p.state?.temperature,
                            moisture: p.state?.moisture,
                            light: p.state?.light,
                            at: p.receivedAt ? Date.parse(p.receivedAt) : null,
                        }, p.optimalRange),
                    }));
                    return {
                        id: srv.id,
                        name: srv.name,
                        location: srv.description,
                        // Only previously synchronized values are available offline.
                        picos: picosList,
                        error: true,
                        address: srv.address,
                        syncIntervalMinutes: 5,
                    };
                }
            })
        );
        setFetchedServers(loaded);
        const intervals = loaded.map(server => server.syncIntervalMinutes).filter((value): value is number => Number.isFinite(value) && value as number >= 1);
        setPollIntervalMinutes(intervals.length ? Math.min(...intervals) : 5);
        setLoading(false);
        setRefreshing(false);
    }, [servers]);

    useEffect(() => {
        let active = true;
        void Promise.resolve().then(() => {
            if (active) void loadData();
        });
        return () => { active = false; };
    }, [loadData]);

    useEffect(() => {
        const timer = setInterval(() => { void loadData(); }, pollIntervalMinutes * 60_000);
        return () => clearInterval(timer);
    }, [loadData, pollIntervalMinutes]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Summary calculation
    const totalPicos = fetchedServers.reduce((acc, s) => acc + s.picos.length, 0);
    const wrongPicos = fetchedServers.reduce((acc, s) => acc + s.picos.filter(p => p.status === 'wrong').length, 0);
    const offlineServers = fetchedServers.filter(s => s.error).length;

    return (
        <View style={{ flex: 1, backgroundColor: c.background }}>
            <ScrollView
                style={[styles.scroll, { backgroundColor: c.background }]}
                contentContainerStyle={{ width: '100%', maxWidth: 1320, alignSelf: 'center', paddingBottom: 88, paddingTop: 24 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.accent} colors={[c.accent]} />
                }
            >
                {/* Custom Premium Header */}
                <View style={[styles.header, { paddingHorizontal: wide * 6, marginBottom: 14 }]}>
                    <View style={[styles.headerIconContainer, { backgroundColor: c.main.cover, borderColor: c.main.outline }]}>
                        <Ionicons name="leaf-outline" size={19} color={c.accent} />
                    </View>
                    <View style={{ flex: 1 }} />
                    <Pressable
                        onPress={() => router.push('/settings')}
                        style={[styles.headerIconContainer, { backgroundColor: c.main.cover, borderColor: c.main.outline }]}
                    >
                        <Ionicons name="settings-outline" size={18} color={c.main.text} />
                    </Pressable>
                </View>

                {/* Dashboard greeting title */}
                <View style={{ paddingHorizontal: wide * 6, marginBottom: 18 }}>
                    <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: 28, color: c.main.text }}>
                        스마트팜 허브
                    </Text>

                    {/* Stats Summary Panel */}
                    <View style={[
                        styles.summaryContainer,
                        {
                            backgroundColor: c.main.cover,
                            borderColor: c.main.outline,
                            padding: 14,
                            borderRadius: 8,
                            marginTop: 12,
                        }
                    ]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                                <View style={[styles.statusDot, { backgroundColor: offlineServers > 0 ? c.red.text : (wrongPicos > 0 ? c.orange.text : c.green.text) }]} />
                                <Text style={{ fontSize: 13, fontFamily: 'Pretendard-Medium', color: c.main.text, marginLeft: 8, flex: 1 }} numberOfLines={1}>
                                    {offlineServers > 0
                                        ? `${offlineServers}개의 서버가 오프라인 상태입니다`
                                        : (wrongPicos > 0 ? `${wrongPicos}개의 경고 상태 확인 됨` : '모든 온실 시스템이 안정적입니다')}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 12, fontFamily: 'Pretendard-Regular', color: c.subText }}>
                                디바이스 {totalPicos}개
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Server Card List */}
                {loading ? (
                    <View style={[styles.centerAlign, { marginTop: wide * 10 }]}>
                        <ActivityIndicator size="large" color={c.accent} />
                    </View>
                ) : (
                    <View style={{ paddingHorizontal: wide * 6, flexDirection: wideLayout ? 'row' : 'column', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
                        {fetchedServers.map((server) => (
                            <ServerCard
                                key={server.id}
                                server={server}
                                wide={wide}
                                isDarkTheme={isDark}
                                wideLayout={wideLayout}
                                onConfigure={() => router.push({ pathname: '/server/[id]/setting', params: { id: server.id} })}
                            />
                        ))}

                        {/* Add new server card at bottom */}
                        <Pressable
                            onPress={() => {router.push('/server/create')}}
                            style={[
                                styles.addServerCard,
                                {
                                    borderColor: c.main.outline,
                                    backgroundColor: 'transparent',
                                    width: wideLayout ? '49%' : '100%',
                                    minHeight: 54,
                                    borderRadius: 8,
                                }
                            ]}
                        >
                            <Ionicons name="add-circle-outline" size={20} color={c.accent} style={{ marginRight: 8 }} />
                            <Text style={{ fontFamily: 'Pretendard-Medium', fontSize: 13, color: c.accent }}>
                                새 온실 서버 추가
                            </Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>

        </View>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 7,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryContainer: {
        borderWidth: 1,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    serverCard: {
        borderWidth: 1,
    },
    serverTitle: {
        fontFamily: 'Pretendard-Bold',
    },
    statusTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        minWidth: 22,
        alignItems: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        rowGap: 8,
    },
    miniPico: {
        justifyContent: 'center',
    },
    miniPicoName: {
        fontFamily: 'Pretendard-Bold',
    },
    miniPicoTxt: {
        fontFamily: 'Pretendard-Medium',
        marginLeft: 4,
    },
    miniValRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    centerAlign: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    addServerCard: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    errorDotBadge: {
        backgroundColor: '#EF4444',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 8,
    },
    gearBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },
});
