import { Colors } from '@/constants/Colors';
import { usePico, type PicoReadingPeriod } from '@/hooks/usePico';
import { useServerAddress } from '@/hooks/useServerAddress';
import { useTheme } from '@/hooks/useTheme';
import type { PicoStatus as PicoStatusType } from '@/types/pico';
import { formatSensorValue } from '@/utils/formatSensorValue';
import { getPicoStatus } from '@/utils/pico';
import { Entypo, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

type Period = PicoReadingPeriod;
type MetricKey = 'temperature' | 'moisture' | 'light';
type Reading = { at: number | null; name: string | null; connected: boolean; temperature: number | null; moisture: number | null; light: number | null };

const periods: { id: Period; label: string }[] = [
    { id: '24h', label: '24시간' },
    { id: '7d', label: '7일' },
    { id: '30d', label: '30일' },
    { id: '1y', label: '1년' },
    { id: 'all', label: '전체' },
];

const metrics: { key: MetricKey; label: string; unit: string; color: string }[] = [
    { key: 'temperature', label: '온도', unit: '°C', color: '#E76F51' },
    { key: 'moisture', label: '습도', unit: '%', color: '#3B82F6' },
    { key: 'light', label: '조도', unit: ' lx', color: '#D97706' },
];

function toRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function toNumber(...values: unknown[]): number | null {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
    }
    return null;
}

function toTimestamp(record: Record<string, unknown>): number | null {
    const value = record.timestamp ?? record.recordedAt ?? record.receivedAt ?? record.createdAt ?? record.updatedAt ?? record.time ?? record.date;
    if (typeof value === 'number' && Number.isFinite(value)) return value < 10_000_000_000 ? value * 1000 : value;
    if (typeof value !== 'string') return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

function extractReadings(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    const record = toRecord(payload);
    if (!record) return [];
    for (const key of ['readings', 'data', 'history', 'records', 'items']) {
        if (Array.isArray(record[key])) return record[key] as unknown[];
    }
    if (Array.isArray(record.pico)) return record.pico;
    if (toRecord(record.pico)) return extractReadings(record.pico);
    return record.state || record.temperature !== undefined || record.temp !== undefined ? [record] : [];
}

function normalizeReadings(payload: unknown): Reading[] {
    return extractReadings(payload).flatMap(value => {
        const record = toRecord(value);
        if (!record) return [];
        const state = toRecord(record.state) ?? toRecord(record.reading) ?? toRecord(record.values) ?? record;
        const temperature = toNumber(state.temperature, state.temp);
        const moisture = toNumber(state.moisture, state.humidity);
        const light = toNumber(state.light, state.lux);
        if (temperature === null && moisture === null && light === null && record.connected !== false) return [];
        return [{ at: toTimestamp(record), name: typeof record.name === 'string' ? record.name : null, connected: record.connected !== false, temperature, moisture, light }];
    }).sort((left, right) => (left.at ?? 0) - (right.at ?? 0));
}

function normalizeCurrentState(payload: unknown): Reading | null {
    const response = toRecord(payload);
    const pico = toRecord(response?.pico) ?? response;
    if (!pico) return null;

    const state = toRecord(pico.state) ?? pico;
    const temperature = toNumber(state.temperature, state.temp);
    const moisture = toNumber(state.moisture, state.humidity);
    const light = toNumber(state.light, state.lux);
    if (temperature === null && moisture === null && light === null && pico.connected !== false) return null;

    return {
        at: toTimestamp(pico),
        name: typeof pico.name === 'string' ? pico.name : null,
        connected: pico.connected !== false,
        temperature,
        moisture,
        light,
    };
}

function MetricChart({ metric, readings, chartWidth, wide, isDark }: {
    metric: typeof metrics[number]; readings: Reading[]; chartWidth: number; wide: number; isDark: boolean;
}) {
    const plotHeight = Math.max(72, wide * 22);
    const plotTop = 28;
    const chartHeight = plotTop + plotHeight + wide * 3;
    const sampled = readings.length > 36
        ? Array.from({ length: 36 }, (_, index) => readings[Math.round(index * (readings.length - 1) / 35)])
        : readings;
    const points = sampled.flatMap((reading, index) => {
        const value = reading[metric.key];
        return value === null ? [] : [{ index, value, reading }];
    });
    const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
    if (!points.length) return null;

    const minimum = Math.min(...points.map(point => point.value));
    const maximum = Math.max(...points.map(point => point.value));
    const range = maximum - minimum || Math.max(Math.abs(maximum) * 0.1, 1);
    const coordinates = points.map(point => ({
        x: sampled.length === 1 ? chartWidth / 2 : point.index * chartWidth / (sampled.length - 1),
        y: plotTop + plotHeight - ((point.value - minimum) / range) * plotHeight,
        value: point.value,
        reading: point.reading,
    }));
    const path = coordinates.reduce((result, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const previous = coordinates[index - 1];
        const previousPrevious = coordinates[index - 2] ?? previous;
        const next = coordinates[index + 1] ?? point;
        const control1X = previous.x + (point.x - previousPrevious.x) / 6;
        const control1Y = previous.y + (point.y - previousPrevious.y) / 6;
        const control2X = point.x - (next.x - previous.x) / 6;
        const control2Y = point.y - (next.y - previous.y) / 6;
        return `${result} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${point.x} ${point.y}`;
    }, '');
    const selectedPoint = selectedPointIndex === null ? null : coordinates[selectedPointIndex] ?? null;
    const selectPointAtTouch = (event: GestureResponderEvent) => {
        const touchX = Math.max(0, Math.min(chartWidth, event.nativeEvent.locationX));
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        coordinates.forEach((point, index) => {
            const distance = Math.abs(point.x - touchX);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });
        setSelectedPointIndex(nearestIndex);
    };
    const tooltipLeft = selectedPoint
        ? Math.max(0, Math.min(chartWidth - 136, selectedPoint.x - 68))
        : 0;

    return (
        <View style={{ marginTop: wide * 3.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: wide * 1.5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: metric.color, marginRight: 8 }} />
                <Text style={{ flex: 1, color: isDark ? '#E2E8F0' : '#1E293B', fontFamily: 'Pretendard-SemiBold', fontSize: wide * 3.1 }}>{metric.label}</Text>
                <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontFamily: 'Pretendard-Medium', fontSize: wide * 2.7 }}>
                    {formatSensorValue(coordinates[coordinates.length - 1].value)}{metric.unit}
                </Text>
            </View>
            <View
                style={{ height: chartHeight, width: chartWidth }}
                onTouchStart={selectPointAtTouch}
                onTouchMove={selectPointAtTouch}
            >
                <Svg width={chartWidth} height={chartHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
                    {[0, 1, 2].map(line => (
                        <Line key={line} x1={0} x2={chartWidth} y1={plotTop + line * plotHeight / 2} y2={plotTop + line * plotHeight / 2} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'} strokeWidth={1} />
                    ))}
                    <Path d={path} fill="none" stroke={metric.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    {selectedPoint && <Line x1={selectedPoint.x} x2={selectedPoint.x} y1={plotTop} y2={plotTop + plotHeight} stroke={metric.color} strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />}
                </Svg>
                {selectedPoint && (
                    <View style={[styles.chartTooltip, { left: tooltipLeft, backgroundColor: isDark ? '#1F2937' : '#1E293B' }]} pointerEvents="none">
                        <Text style={{ color: '#FFFFFF', fontFamily: 'Pretendard-SemiBold', fontSize: wide * 2.6 }}>
                            {formatSensorValue(selectedPoint.value)}{metric.unit}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'Pretendard-Regular', fontSize: wide * 2.1, marginTop: 1 }}>
                            {selectedPoint.reading.at ? new Date(selectedPoint.reading.at).toLocaleString('ko-KR') : '시간 정보 없음'}
                        </Text>
                    </View>
                )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                <Text style={{ color: isDark ? '#64748B' : '#94A3B8', fontFamily: 'Pretendard-Regular', fontSize: wide * 2.3 }}>{readings[0]?.at ? new Date(readings[0].at).toLocaleDateString('ko-KR') : ''}</Text>
                <Text style={{ color: isDark ? '#64748B' : '#94A3B8', fontFamily: 'Pretendard-Regular', fontSize: wide * 2.3 }}>{readings[readings.length - 1]?.at ? new Date(readings[readings.length - 1].at as number).toLocaleDateString('ko-KR') : ''}</Text>
            </View>
        </View>
    );
}

export default function PicoStatus() {
    const { id: serverId = '', pico: picoId = '' } = useLocalSearchParams<{ id: string; pico: string }>();
    const router = useRouter();
    const { isDark } = useTheme();
    const c = isDark ? Colors.dark : Colors.light;
    const { width, height } = useWindowDimensions();
    const wide = Math.min(width, height) * 0.01;
    const { servers, loaded } = useServerAddress();
    const server = servers.find(item => item.id === serverId);
    const { getPicoState, getPicoReadings, setPicoName } = usePico();
    const [statePayload, setStatePayload] = useState<unknown>(null);
    const [readingsPayload, setReadingsPayload] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<Period>('24h');
    const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
    const [renameMenuOpen, setRenameMenuOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [renameSaving, setRenameSaving] = useState(false);
    const [renameError, setRenameError] = useState<string | null>(null);

    const loadReadings = useCallback(async () => {
        if (!server || !picoId) return;
        setError(null);
        try {
            const [stateResult, readingsResult] = await Promise.allSettled([
                getPicoState(server.id, picoId),
                getPicoReadings(server.id, picoId, period),
            ]);
            const errors: string[] = [];
            if (stateResult.status === 'fulfilled') setStatePayload(stateResult.value);
            else errors.push('현재 Pico 상태를 불러오지 못했습니다.');
            if (readingsResult.status === 'fulfilled') setReadingsPayload(readingsResult.value);
            else errors.push('Pico 측정 기록을 불러오지 못했습니다.');
            setError(errors.length ? errors.join(' ') : null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Pico 데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [getPicoReadings, getPicoState, period, picoId, server]);

    useEffect(() => {
        if (!server || !picoId) return;
        let active = true;
        void Promise.resolve().then(() => { if (active) void loadReadings(); });
        return () => { active = false; };
    }, [loadReadings, picoId, server]);

    const readings = useMemo(() => normalizeReadings(readingsPayload), [readingsPayload]);
    const current = useMemo(() => normalizeCurrentState(statePayload), [statePayload]);
    const selectedPeriod = periods.find(option => option.id === period) ?? periods[0];
    const hasStatusValues = current?.temperature !== null && current?.temperature !== undefined
        && current?.moisture !== null && current?.moisture !== undefined;
    const status: PicoStatusType | null = !current ? null : !current.connected ? 'disconnected'
        : hasStatusValues ? getPicoStatus({ connected: true, temperature: current.temperature as number, moisture: current.moisture as number }) : null;
    const statusColor = status === 'normal' ? c.green.text : status === 'wrong' ? c.red.text : status === 'disconnected' ? c.subText : c.orange.text;
    const statusLabel = status === 'normal' ? '정상' : status === 'wrong' ? '주의 필요' : status === 'disconnected' ? '연결 끊김' : '상태 정보 없음';
    const updatedAt = current?.at ? new Date(current.at).toLocaleString('ko-KR') : '업데이트 시간 정보 없음';
    const chartWidth = Math.max(width - wide * 18, 180);

    const refresh = () => { setRefreshing(true); void loadReadings(); };

    const openRenameMenu = () => {
        setRenameValue(current?.name ?? picoId);
        setRenameError(null);
        setRenameMenuOpen(true);
    };

    const savePicoName = async () => {
        const name = renameValue.trim();
        if (!server || !name || renameSaving) return;

        setRenameSaving(true);
        setRenameError(null);
        try {
            await setPicoName(server.id, picoId, name);
            setRenameMenuOpen(false);
            await loadReadings();
        } catch (saveError) {
            setRenameError(saveError instanceof Error ? saveError.message : 'Pico 이름을 변경하지 못했습니다.');
        } finally {
            setRenameSaving(false);
        }
    };

    if (!server && loaded) {
        return <View style={[styles.container, styles.centered, { backgroundColor: c.background }]}><Text style={{ color: c.subText }}>서버 정보를 찾을 수 없습니다.</Text></View>;
    }

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            <ScrollView style={styles.scroll} contentContainerStyle={{ padding: wide * 5, paddingBottom: wide * 22 }} refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} colors={[c.accent]} />
            }>
                { /* back & title */ }
                <View style={[styles.header, { paddingTop: wide * 3, paddingBottom: wide * 2 }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel="뒤로가기" onPress={() => router.back()} style={[styles.headerIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }]}>
                        <Ionicons name="chevron-back" size={wide * 5} color={c.main.text} />
                    </Pressable>
                    <View style={{ flex: 1 }} />
                </View>

                <View style={{ paddingBottom: wide * 3 }}>
                    <View style={[{ flexDirection: 'row' }]}>
                        <Text style={{ color: c.main.text, fontFamily: 'Pretendard-Bold', fontSize: wide * 7 }} numberOfLines={1}>{current?.name || picoId || 'Pico'}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel="이름 변경" onPress={openRenameMenu} style={[styles.headerIcon, { marginLeft: wide * 5, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }]}>
                            <Entypo name="pencil" size={wide * 7} color={c.main.text} />
                        </Pressable>
                    </View>
                    <Text style={{ color: c.subText, fontFamily: 'Pretendard-Regular', fontSize: wide * 2.8, marginTop: wide }}>최근 업데이트 · {updatedAt}</Text>
                </View>
                {error && <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(248,113,113,0.08)' : '#FEF2F2', borderColor: isDark ? 'rgba(248,113,113,0.2)' : '#FECACA' }]}><Ionicons name="warning-outline" size={wide * 4} color={c.red.text} /><Text style={{ flex: 1, color: c.red.text, fontFamily: 'Pretendard-Medium', fontSize: wide * 2.8, marginLeft: wide * 2 }}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="다시 불러오기" onPress={() => void loadReadings()}><Ionicons name="refresh" size={wide * 4.5} color={c.red.text} /></Pressable></View>}
                {loading ? <View style={[styles.centered, { paddingVertical: wide * 16 }]}><ActivityIndicator size="large" color={c.accent} /></View> : (
                    <>
                        <View style={[styles.section, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4, marginBottom: wide * 4 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: wide * 4 }}>
                                <Text style={{ color: c.main.text, fontFamily: 'Pretendard-SemiBold', fontSize: wide * 4 }}>현재 상태</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${statusColor}18`, paddingHorizontal: wide * 2.5, paddingVertical: wide, borderRadius: wide * 4 }}><View style={{ width: wide * 1.7, height: wide * 1.7, borderRadius: wide, backgroundColor: statusColor, marginRight: wide }} /><Text style={{ color: statusColor, fontFamily: 'Pretendard-Bold', fontSize: wide * 2.8 }}>{statusLabel}</Text></View>
                            </View>
                            <View style={styles.valueGrid}>{metrics.map(metric => <View key={metric.key} style={{ flex: 1, minWidth: '28%' }}><Text style={{ color: c.subText, fontFamily: 'Pretendard-Regular', fontSize: wide * 2.6 }}>{metric.label}</Text><Text style={{ color: metric.color, fontFamily: 'Pretendard-Bold', fontSize: wide * 4.2, marginTop: wide }}>{formatSensorValue(current?.[metric.key] ?? undefined)}<Text style={{ fontSize: wide * 2.8 }}>{metric.unit}</Text></Text></View>)}</View>
                        </View>

                        <View style={[styles.section, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: wide * 2 }}>
                                <Text style={{ color: c.main.text, fontFamily: 'Pretendard-SemiBold', fontSize: wide * 4 }}>센서 기록</Text>
                                <Pressable accessibilityRole="button" accessibilityLabel="그래프 기간 선택" onPress={() => setPeriodMenuOpen(true)} style={[styles.periodButton, { borderColor: c.main.outline, backgroundColor: c.sub.cover }]}><Text style={{ color: c.main.text, fontFamily: 'Pretendard-Medium', fontSize: wide * 2.8 }}>{selectedPeriod.label}</Text><Ionicons name="chevron-down" size={wide * 3.2} color={c.subText} /></Pressable>
                            </View>
                            {readings.length === 0 ? <Text style={{ color: c.subText, fontFamily: 'Pretendard-Regular', paddingVertical: wide * 5 }}>선택한 기간에 측정 기록이 없습니다.</Text> : metrics.map(metric => <MetricChart key={metric.key} metric={metric} readings={readings} chartWidth={chartWidth} wide={wide} isDark={isDark} />)}
                        </View>
                    </>
                )}
            </ScrollView>

            { /* period popup */ }
            <Modal visible={periodMenuOpen} transparent animationType="fade" onRequestClose={() => setPeriodMenuOpen(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setPeriodMenuOpen(false)}>
                    <View style={[styles.periodMenu, { backgroundColor: c.main.cover, borderColor: c.main.outline }]}>
                        <Text style={{ color: c.main.text, fontFamily: 'Pretendard-Bold', fontSize: wide * 4, marginBottom: wide * 2 }}>기간 선택</Text>
                        {periods.map(option => (
                            <Pressable key={option.id} onPress={() => { setLoading(true); setPeriod(option.id); setPeriodMenuOpen(false); }} style={[styles.periodOption, { borderTopColor: c.main.outline }]}>
                                <Text style={{ color: period === option.id ? c.accent : c.main.text, fontFamily: period === option.id ? 'Pretendard-Bold' : 'Pretendard-Regular', fontSize: wide * 3.2 }}>{option.label}</Text>
                                {period === option.id && <Ionicons name="checkmark" size={wide * 4} color={c.accent} />}
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            </Modal>

            <Modal visible={renameMenuOpen} transparent animationType="fade" onRequestClose={() => { if (!renameSaving) setRenameMenuOpen(false); }}>
                <Pressable style={styles.modalBackdrop} onPress={() => { if (!renameSaving) setRenameMenuOpen(false); }}>
                    <Pressable style={[styles.renameDialog, { backgroundColor: c.main.cover, borderColor: c.main.outline }]} onPress={event => event.stopPropagation()}>
                        <Text style={{ color: c.main.text, fontFamily: 'Pretendard-Bold', fontSize: wide * 4.5 }}>Pico 이름 변경</Text>
                        <Text style={{ color: c.subText, fontFamily: 'Pretendard-Regular', fontSize: wide * 2.8, marginTop: wide * 1.5 }}>새 이름을 입력하세요.</Text>
                        <TextInput
                            accessibilityLabel="새 Pico 이름"
                            autoFocus
                            maxLength={40}
                            returnKeyType="done"
                            onSubmitEditing={() => void savePicoName()}
                            value={renameValue}
                            onChangeText={setRenameValue}
                            placeholder="Pico 이름"
                            placeholderTextColor={c.subText}
                            editable={!renameSaving}
                            style={[styles.renameInput, { color: c.main.text, borderColor: c.main.outline }]}
                        />
                        {renameError && <Text style={{ color: c.red.text, fontFamily: 'Pretendard-Regular', fontSize: wide * 2.7, marginTop: wide * 1.5 }}>{renameError}</Text>}
                        <View style={styles.renameActions}>
                            <Pressable disabled={renameSaving} onPress={() => setRenameMenuOpen(false)} style={[styles.renameButton, { borderColor: c.main.outline }]}>
                                <Text style={{ color: c.main.text, fontFamily: 'Pretendard-SemiBold' }}>취소</Text>
                            </Pressable>
                            <Pressable disabled={renameSaving || !renameValue.trim()} onPress={() => void savePicoName()} style={[styles.renameButton, { backgroundColor: c.accent, opacity: renameSaving || !renameValue.trim() ? 0.55 : 1 }]}>
                                <Text style={{ color: '#FFFFFF', fontFamily: 'Pretendard-Bold' }}>{renameSaving ? '변경 중...' : '확인'}</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
            
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center' },
    headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    scroll: { flex: 1 },
    centered: { alignItems: 'center', justifyContent: 'center' },
    section: { borderWidth: 1, borderRadius: 12 },
    valueGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    periodButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
    chartTooltip: { position: 'absolute', top: 0, width: 136, minHeight: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, zIndex: 2 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'center', padding: 24 },
    periodMenu: { width: '100%', maxWidth: 360, alignSelf: 'center', borderWidth: 1, borderRadius: 12, padding: 18 },
    periodOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1 },
    renameDialog: { width: '100%', maxWidth: 380, alignSelf: 'center', borderWidth: 1, borderRadius: 12, padding: 20 },
    renameInput: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginTop: 16, fontFamily: 'Pretendard-Medium' },
    renameActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    renameButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8 },
});
