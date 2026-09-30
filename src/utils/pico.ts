import type { PicoOptimalRange, PicoStatus } from '@/types/pico';

type SensorReading = {
    connected?: boolean;
    temperature?: number | null;
    moisture?: number | null;
    light?: number | null;
    at?: number | null;
};

export type TimedLightReading = { at: number | null; light: number | null };

// Count the previous sample's light level until the next sample, but not across long data gaps.
const MAX_COUNTED_SAMPLE_GAP_MS = 15 * 60 * 1000;

export function getLocalDayKey(timestamp: number) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getDailyLightExposureHours(readings: TimedLightReading[], lightRange: PicoOptimalRange['light'], now = Date.now()) {
    const sorted = readings
        .filter((reading): reading is { at: number; light: number } => reading.at !== null && reading.light !== null && Number.isFinite(reading.at) && Number.isFinite(reading.light))
        .sort((left, right) => left.at - right.at);
    const durations: Record<string, number> = {};

    const addDuration = (timestamp: number, durationMs: number) => {
        const day = getLocalDayKey(timestamp);
        durations[day] = (durations[day] ?? 0) + durationMs / 3_600_000;
    };

    sorted.forEach((reading, index) => {
        const next = sorted[index + 1];
        if (!next || getLocalDayKey(reading.at) !== getLocalDayKey(next.at)) return;
        if (reading.light < lightRange.min || reading.light > lightRange.max) return;
        const gap = next.at - reading.at;
        if (gap > 0) addDuration(reading.at, Math.min(gap, MAX_COUNTED_SAMPLE_GAP_MS));
    });

    const latest = sorted[sorted.length - 1];
    if (latest && getLocalDayKey(latest.at) === getLocalDayKey(now)
        && latest.light >= lightRange.min && latest.light <= lightRange.max) {
        const gap = now - latest.at;
        if (gap > 0) addDuration(latest.at, Math.min(gap, MAX_COUNTED_SAMPLE_GAP_MS));
    }

    return durations;
}

export function getCompleteLightExposureDays(readings: TimedLightReading[]) {
    const samples = readings
        .filter((reading): reading is { at: number; light: number } => reading.at !== null && reading.light !== null && Number.isFinite(reading.at) && Number.isFinite(reading.light))
        .sort((left, right) => left.at - right.at);
    const coverage: Record<string, { first: number; last: number }> = {};

    samples.forEach(({ at }) => {
        const key = getLocalDayKey(at);
        coverage[key] ??= { first: at, last: at };
        coverage[key].first = Math.min(coverage[key].first, at);
        coverage[key].last = Math.max(coverage[key].last, at);
    });

    return new Set(Object.entries(coverage).filter(([key, times]) => {
        const [year, month, day] = key.split('-').map(Number);
        const dayStart = new Date(year, month - 1, day).getTime();
        const nextDayStart = new Date(year, month - 1, day + 1).getTime();
        return times.first <= dayStart + MAX_COUNTED_SAMPLE_GAP_MS
            && times.last >= nextDayStart - MAX_COUNTED_SAMPLE_GAP_MS;
    }).map(([key]) => key));
}

export function isOutsideOptimalRange(reading: SensorReading, range: PicoOptimalRange, lightDurationHours?: number, lightDayComplete = false) {
    if (reading.temperature != null && (reading.temperature < range.temperature.min || reading.temperature > range.temperature.max)) return true;
    if (reading.moisture != null && (reading.moisture < range.moisture.min || reading.moisture > range.moisture.max)) return true;
    if (reading.light != null && (reading.light < range.light.min || reading.light > range.light.max)) return true;
    if (lightDurationHours != null && (lightDurationHours > range.light.maxDurationHours
        || lightDayComplete && lightDurationHours < range.light.minDurationHours)) return true;
    return false;
}

export function getPicoStatus(reading: SensorReading & { connected: boolean; temperature: number; moisture: number }, optimalRange?: PicoOptimalRange, lightDurationHours?: number): PicoStatus {
    if (!reading.connected) return 'disconnected';
    if (optimalRange) return isOutsideOptimalRange(reading, optimalRange, lightDurationHours) ? 'wrong' : 'normal';
    if (reading.temperature > 30 || reading.temperature < 15 || reading.moisture < 30) return 'wrong';
    return 'normal';
}