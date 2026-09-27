import type { PicoStatus } from '@/types/pico';

export function getPicoStatus(reading: { connected: boolean; temperature: number; moisture: number }): PicoStatus {
    if (!reading.connected) return 'disconnected';
    if (reading.temperature > 30 || reading.temperature < 15 || reading.moisture < 30) return 'wrong';
    return 'normal';
}