import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface ServerConfig {
    id: string;
    name: string;
    description: string;
    address: string;
}

interface ServerAddressContextType {
    servers: ServerConfig[];
    loaded: boolean;
    updateServerConfig: (id: string, name: string, description: string, address: string) => void;
    addServerConfig: (name: string, description: string, address: string) => string;
    deleteServerConfig: (id: string) => void;
    getServerById: (id: string) => ServerConfig | undefined;
    getServerApiKey: (id: string) => Promise<string>;
    setServerApiKey: (id: string, apiKey: string) => Promise<void>;
}

const ServerAddressContext = createContext<ServerAddressContextType | undefined>(undefined);

const INITIAL_SERVERS: ServerConfig[] = [];

const STORAGE_KEY = '@leaf/server-configs';

const getApiKeyStorageKey = (id: string) => {
    const safeId = id.replace(/[^A-Za-z0-9._-]/g, '_');
    return safeId ? `leaf-api-key-${safeId}` : '';
};

export function ServerAddressProvider({ children }: { children: React.ReactNode }) {
    const [servers, setServers] = useState<ServerConfig[]>(INITIAL_SERVERS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then((saved) => {
                if (!saved) return;
                const parsed: unknown = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.every(item =>
                    item && typeof item.id === 'string' && typeof item.name === 'string'
                    && typeof item.description === 'string' && typeof item.address === 'string'
                )) {
                    const migrated = (parsed as (ServerConfig & { apiKey?: unknown })[]).map(({ apiKey, ...server }) => {
                        const key = getApiKeyStorageKey(server.id);
                        if (key && typeof apiKey === 'string' && apiKey) void SecureStore.setItemAsync(key, apiKey);
                        return server;
                    });
                    setServers(migrated);
                    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                }
            })
            .catch(() => {
                // The default configuration remains usable if local storage is unavailable.
            })
            .finally(() => setLoaded(true));
    }, []);

    const save = (next: ServerConfig[]) => {
        setServers(next);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const getServerApiKey = useCallback((id: string) => {
        const key = getApiKeyStorageKey(id);
        return key ? SecureStore.getItemAsync(key).then(value => value ?? '') : Promise.resolve('');
    }, []);
    const setServerApiKey = useCallback(async (id: string, apiKey: string) => {
        const key = getApiKeyStorageKey(id);
        if (!key) return;
        if (apiKey) await SecureStore.setItemAsync(key, apiKey);
        else await SecureStore.deleteItemAsync(key);
    }, []);

    const updateServerConfig = (id: string, name: string, description: string, address: string) => {
        save(servers.map((srv) => srv.id === id ? { ...srv, name, description, address } : srv));
    };

    const addServerConfig = (name: string, description: string, address: string): string => {
        const newId = `Server_${Date.now()}`;
        save([...servers, { id: newId, name, description, address }]);
        return newId;
    };

    const deleteServerConfig = (id: string) => {
        const key = getApiKeyStorageKey(id);
        if (key) void SecureStore.deleteItemAsync(key);
        save(servers.filter((srv) => srv.id !== id));
    };

    const getServerById = (id: string) => servers.find((server) => server.id === id);

    return (
        <ServerAddressContext.Provider value={{ servers, loaded, updateServerConfig, addServerConfig, deleteServerConfig, getServerById, getServerApiKey, setServerApiKey }}>
            {children}
        </ServerAddressContext.Provider>
    );
}

export function useServerAddress() {
    const context = useContext(ServerAddressContext);
    if (context === undefined) {
        throw new Error('useServerAddress must be used within a ServerAddressProvider');
    }
    return context;
}
