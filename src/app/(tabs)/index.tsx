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

function MiniPicoCard({ pico, isServerDark, wide, tabletLayout }: { pico: Pico; isServerDark: boolean; wide: number; tabletLayout: boolean }) {
    const c = isServerDark ? Colors.dark : Colors.light;
    const statusColor = pico.status === 'normal' ? c.green : pico.status === 'wrong' ? c.red : c.sub;
    const lightValueColor = c.orange.text;
    const picoBackground = pico.status === 'normal' ? c.green.cover : pico.status === 'wrong' ? c.red.cover : c.sub.cover;
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
                backgroundColor: picoBackground,
                width: tabletLayout ? '24%' : '48%',
                minHeight: tabletLayout ? 72 : 54,
                padding: tabletLayout ? 9 : 7,
                borderRadius: 7,
                borderColor: statusColor.outline,
                borderWidth: 1,
                },
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: wide * 0.8 }}>
                <Text style={[styles.miniPicoName, { color: c.main.text, fontSize: 12 }]} numberOfLines={1}>
                    {pico.name}
                </Text>
                {pico.status !== 'disconnected' && <View style={dotStyle} />}
            </View>

            {pico.status !== 'disconnected' ? (
                <View style={styles.miniValues}>
                    <Text style={[styles.miniPicoTxt, { color: c.main.text }]}>{formatSensorValue(pico.temp)}°C</Text>
                    <Text style={[styles.miniPicoTxt, { color: c.main.text }]}>{formatSensorValue(pico.humidity)}%</Text>
                    <Text style={[styles.miniPicoTxt, { color: lightValueColor }]} numberOfLines={1}>{formatSensorValue(pico.light)} lx</Text>
                </View>
            ) : (
                <Text style={[styles.miniPicoTxt, { color: c.subText, marginTop: 3 }]}>disconnected</Text>
            )}
        </View>
    );
}

function ServerCard({ server, wide, isDarkTheme, wideLayout, tabletLayout, onConfigure }: {
    server: Server;
    wide: number;
    isDarkTheme: boolean;
    wideLayout: boolean;
    tabletLayout: boolean;
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
        <Pressable onPress={pressHandler} style={{ width: mobileServerWidth }}>
            <Animated.View style={[
                animStyle,
                styles.serverCard,
                {
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                    borderRadius: 16,
                    padding: tabletLayout ? 17 : 14,
                    shadowColor: '#10231E',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.18 : 0.06,
                    shadowRadius: 12,
                    elevation: isDark ? 2 : 3,
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
                        <MiniPicoCard key={idx} pico={pico} isServerDark={isDark} wide={wide} tabletLayout={tabletLayout} />
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
    const tabletLayout = width >= 700;
    const wideLayout = width >= 760;
    const mobileServerWidth = width < 700 ? '74%' : (wideLayout ? '49%' : '100%');
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
                contentContainerStyle={{ width: '100%', maxWidth: 1180, alignSelf: 'center', paddingBottom: 88, paddingTop: tabletLayout ? 26 : 18 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.accent} colors={[c.accent]} />
                }
            >
                {/* Custom Premium Header */}
                <View style={[styles.header, { paddingHorizontal: tabletLayout ? 28 : 12, marginBottom: 14 }]}>
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

                {/* Server Card List */}
                {loading ? (
                    <View style={[styles.centerAlign, { marginTop: wide * 10 }]}>
                        <ActivityIndicator size="large" color={c.accent} />
                    </View>
                ) : (
                    <View style={{ paddingHorizontal: tabletLayout ? 28 : 0, flexDirection: wideLayout ? 'row' : 'column', flexWrap: 'wrap', justifyContent: wideLayout ? 'space-between' : 'center', alignItems: wideLayout ? 'stretch' : 'center', rowGap: 14 }}>
                        {fetchedServers.map((server) => (
                            <ServerCard
                                key={server.id}
                                server={server}
                                wide={wide}
                                isDarkTheme={isDark}
                                wideLayout={wideLayout}
                                tabletLayout={tabletLayout}
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
                                    width: mobileServerWidth,
                                    minHeight: tabletLayout ? 64 : 88,
                                    borderRadius: 14,
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
        width: 38,
        height: 38,
        borderRadius: 12,
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
        fontFamily: 'Pretendard-Regular',
        fontSize: 11,
        lineHeight: 14,
    },
    miniValues: {
        gap: 0,
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
