export type PicoState = {
    temperature: number;
    moisture: number;
    light: number;
};

export type PicoReading = {
    name: string;
    id: string;
    connected: boolean;
    state: PicoState;
    receivedAt?: string;
};

export type PicoReadingsResponse = {
    state: number;
    source?: 'latest-received';
    servedAt?: string;
    pico: PicoReading[];
};

export type PicoStatus = 'normal' | 'wrong' | 'disconnected';