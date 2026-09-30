export type PicoState = {
    temperature: number;
    moisture: number;
    light: number;
};

export type PicoOptimalRange = {
    temperature: { min: number; max: number };
    moisture: { min: number; max: number };
    light: { min: number; max: number; minDurationHours: number; maxDurationHours: number };
};

export type PicoReading = {
    name: string;
    id: string;
    connected: boolean;
    state: PicoState;
    optimalRange?: PicoOptimalRange;
    receivedAt?: string;
};

export type PicoReadingsResponse = {
    state: number;
    source?: 'latest-received';
    servedAt?: string;
    pico: PicoReading[];
};

export type PicoStatus = 'normal' | 'wrong' | 'disconnected';