import { useServerAddress } from '@/hooks/useServerAddress';
import type { PicoOptimalRange } from '@/types/pico';
import { useCallback } from 'react';

export type PicoReadingPeriod = '24h' | '7d' | '30d' | '1y' | 'all';

async function readResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        throw new Error(`Pico API request failed (HTTP ${response.status})`);
    }

    if (response.status === 204) return undefined as T;
    return await response.json() as T;
}

export function usePico() {
    const { servers, getServerApiKey } = useServerAddress();

    const getPicoState = useCallback(async <TResponse = unknown>(serverId: string, picoId: string): Promise<TResponse> => {
        const server = servers.find(item => item.id === serverId);
        if (!server) throw new Error(`Server not found: ${serverId}`);

        const baseUrl = server.address.startsWith('http') ? server.address : `http://${server.address}`;
        const response = await fetch(`${baseUrl}/picos/${encodeURIComponent(picoId)}/state`, {
            headers: { Accept: 'application/json' },
        });

        return readResponse<TResponse>(response);
    }, [servers]);

    const getPicoReadings = useCallback(async <TResponse = unknown>(serverId: string, picoId: string, period: PicoReadingPeriod = '24h'): Promise<TResponse> => {
        const server = servers.find(item => item.id === serverId);
        if (!server) throw new Error(`Server not found: ${serverId}`);

        const baseUrl = server.address.startsWith('http') ? server.address : `http://${server.address}`;
        const response = await fetch(`${baseUrl}/picos/${encodeURIComponent(picoId)}/readings?period=${period}`, {
            headers: { Accept: 'application/json' },
        });

        return readResponse<TResponse>(response);
    }, [servers]);

    const setPicoName = useCallback(async <TResponse = unknown>(serverId: string, picoId: string, name: string): Promise<TResponse> => {
        const server = servers.find(item => item.id === serverId);
        if (!server) throw new Error(`Server not found: ${serverId}`);

        const baseUrl = server.address.startsWith('http') ? server.address : `http://${server.address}`;
        const apiKey = await getServerApiKey(serverId) || process.env.EXPO_PUBLIC_SMARTFARM_API_KEY || '';
        if (!apiKey) throw new Error('서버 API 키를 먼저 설정하세요.');
        const response = await fetch(`${baseUrl}/picos/${encodeURIComponent(picoId)}/setName`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
            },
            body: JSON.stringify({ name }),
        });

        return readResponse<TResponse>(response);
    }, [getServerApiKey, servers]);

    const setPicoOptimalRange = useCallback(async (serverId: string, picoId: string, optimalRange: PicoOptimalRange): Promise<void> => {
        const server = servers.find(item => item.id === serverId);
        if (!server) throw new Error(`Server not found: ${serverId}`);

        const baseUrl = server.address.startsWith('http') ? server.address : `http://${server.address}`;
        const apiKey = await getServerApiKey(serverId) || process.env.EXPO_PUBLIC_SMARTFARM_API_KEY || '';
        if (!apiKey) throw new Error('서버 API 키를 먼저 설정하세요.');
        const response = await fetch(`${baseUrl}/picos/${encodeURIComponent(picoId)}/optimalRange`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
            },
            body: JSON.stringify(optimalRange),
        });
        if (!response.ok) throw new Error(`적정 범위 저장 실패 (HTTP ${response.status})`);
    }, [getServerApiKey, servers]);

    return { getPicoState, getPicoReadings, setPicoName, setPicoOptimalRange };
}