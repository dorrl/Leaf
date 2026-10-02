import { Colors } from '@/constants/Colors';
import { BackButton } from '@/components/BackButton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { FormField } from '@/components/FormField';
import { ServerConfig, useServerAddress } from '@/hooks/useServerAddress';
import { useTheme } from '@/hooks/useTheme';
import { clearServerSnapshot } from '@/utils/localData';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

type RuntimeSettings = { measurementIntervalMinutes: number; syncIntervalMinutes: number; retentionMonths: number };

function ServerRuntimeSettings({ server, wide, c }: { server: ServerConfig; wide: number; c: typeof Colors.dark }) {
    const { getServerApiKey } = useServerAddress();
    const [settings, setSettings] = useState<RuntimeSettings>({ measurementIntervalMinutes: 1, syncIntervalMinutes: 5, retentionMonths: 6 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const baseUrl = server.address.startsWith('http') ? server.address : `http://${server.address}`;

    useEffect(() => {
        let active = true;
        Promise.all([fetch(`${baseUrl}/settings`, { headers: { Accept: 'application/json' } }), getServerApiKey(server.id)])
            .then(([response, savedKey]) => response.ok ? Promise.all([response.json(), savedKey]) : Promise.reject(new Error(`HTTP ${response.status}`)))
            .then(([json, savedKey]) => { if (active && json.settings) { setSettings(json.settings); setApiKey(savedKey); } })
            .catch(() => { if (active) setMessage('서버 설정을 불러올 수 없습니다.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [baseUrl, getServerApiKey, server.id]);

    const save = async () => {
        const measurementIntervalMinutes = Number(settings.measurementIntervalMinutes);
        const syncIntervalMinutes = Number(settings.syncIntervalMinutes);
        const retentionMonths = Number(settings.retentionMonths);
        if (measurementIntervalMinutes !== 1 || !Number.isInteger(syncIntervalMinutes) || syncIntervalMinutes < 1 || syncIntervalMinutes > 1440 || !Number.isInteger(retentionMonths) || retentionMonths < 1 || retentionMonths > 60) {
            setMessage('저장·앱 갱신 주기는 1~1440분, 보관 기간은 1~60개월로 입력하세요.');
            return;
        }
        setSaving(true); setMessage('');
        try {
            const response = await fetch(`${baseUrl}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey || process.env.EXPO_PUBLIC_SMARTFARM_API_KEY || '' },
                body: JSON.stringify({ measurementIntervalMinutes, syncIntervalMinutes, retentionMonths }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            setMessage('저장·앱 갱신 주기와 보관 기간이 서버에 저장되었습니다.');
        } catch {
            setMessage('저장에 실패했습니다. 서버 주소와 API 키를 확인하세요.');
        } finally { setSaving(false); }
    };

    const deleteSavedData = async () => {
        setShowDeleteModal(false);
        setSaving(true); setMessage('');
        try {
            const response = await fetch(`${baseUrl}/data`, {
                method: 'DELETE',
                headers: { 'X-API-Key': apiKey || process.env.EXPO_PUBLIC_SMARTFARM_API_KEY || '' },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await clearServerSnapshot(server.id);
            setMessage('서버와 휴대폰에 저장된 측정 데이터가 삭제되었습니다.');
        } catch {
            setMessage('삭제에 실패했습니다. 서버 주소와 API 키를 확인하세요.');
        } finally { setSaving(false); }
    };

    return <View style={[styles.card, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4, marginBottom: wide * 3, paddingTop: 0 }]}>
        {loading ? <ActivityIndicator color={c.accent} style={{ marginBottom: wide * 4 }} /> : <>
            <Text style={[styles.label, { color: c.subText, fontSize: wide * 3 }]}>센서 측정 주기</Text>
            <Text style={[styles.fixedValue, { color: c.sub.text, borderColor: c.main.outline }]}>1분마다 측정</Text>
            <FormField label="서버 저장·앱 갱신 주기 (분)" value={String(settings.syncIntervalMinutes)} onChangeText={value => setSettings(current => ({ ...current, syncIntervalMinutes: Number(value) }))} textColor={c.main.text} borderColor={c.main.outline} labelColor={c.subText} keyboardType="number-pad" />
            <FormField label="측정값 보관 기간 (개월)" value={String(settings.retentionMonths)} onChangeText={value => setSettings(current => ({ ...current, retentionMonths: Number(value) }))} textColor={c.main.text} borderColor={c.main.outline} labelColor={c.subText} keyboardType="number-pad" />
            <Pressable onPress={save} disabled={saving} style={[styles.saveButton, saving ? styles.disabled : {}, { backgroundColor: c.accent }]}>
                <Text style={styles.saveText}>{saving ? '저장 중...' : '서버 설정 저장'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowDeleteModal(true)} disabled={saving} style={[styles.deleteButton, saving ? styles.disabled : {}, { borderColor: c.red.text}]}>
                <Text style={[styles.deleteText, { color: c.red.text }]}>저장된 측정 데이터 삭제</Text>
            </Pressable>
            {!!message && <Text style={{ color: c.subText, fontFamily: 'Pretendard-Regular', fontSize: wide * 2.7, marginTop: wide * 2 }}>{message}</Text>}
        </>}
        <ConfirmModal visible={showDeleteModal} title="서버 측정 데이터 삭제" message={`${server.name} 서버에 저장된 모든 측정값과 알림을 삭제합니다. 센서와 측정 주기 설정은 유지됩니다.`} onCancel={() => setShowDeleteModal(false)} onConfirm={() => void deleteSavedData()} c={c} />
    </View>;
}

function ServerAddressForm({ server, wide, c }: { server: ServerConfig; wide: number; c: typeof Colors.dark }) {
    const { updateServerConfig, getServerApiKey, setServerApiKey } = useServerAddress();
    const [name, setName] = useState(server.name); const [description, setDescription] = useState(server.description); const [address, setAddress] = useState(server.address); const [apiKey, setApiKey] = useState(''); const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(() => { void getServerApiKey(server.id).then(setApiKey); }, [server.id, getServerApiKey]);
    const disabled: boolean = 
        saving || ((server.name === name.trim() && server.description === description.trim() && server.address === address.trim().replace(/\/$/, '')) && !message) ||
        name.trim() === '' || address.trim().replace(/\/$/, '') === ''
    return (
        <View>
            <Text style={[styles.label, { color: c.subText, fontSize: wide * 3 }]}>서버 id</Text>
            <Text style={[styles.fixedValue, { color: c.sub.text, borderColor: c.main.outline }]}>{server.id}</Text>
            <FormField label="이름" value={name} onChangeText={setName} textColor={c.main.text} borderColor={name ? c.main.outline : c.red.outline} labelColor={c.subText} placeholder="(필수)" placeholderColor={c.red.outline} />
            <FormField label="설명" value={description} onChangeText={setDescription} textColor={c.main.text} borderColor={c.main.outline} labelColor={c.subText} />
            <FormField label="주소" value={address} onChangeText={setAddress} textColor={c.main.text} borderColor={address ? c.main.outline : c.red.outline} labelColor={c.subText} placeholder="(필수)" placeholderColor={c.red.outline} autoCapitalize="none" />
            <FormField label="서버 API 키" value={apiKey} onChangeText={setApiKey} textColor={c.main.text} borderColor={c.main.outline} labelColor={c.subText} placeholder="(설정 변경·삭제용)" placeholderColor={c.subText} secureTextEntry autoCapitalize="none" />
            <Pressable style={[styles.saveButton, disabled ? styles.disabled : {}, { backgroundColor: c.accent }]} disabled={disabled}
            onPress={async () => {
                setSaving(true);
                setMessage('');
                try {
                    updateServerConfig(server.id, name.trim(), description.trim(), address.trim().replace(/\/$/, ''));
                    await setServerApiKey(server.id, apiKey.trim());
                    setMessage('연결 정보가 저장되었습니다.');
                } catch {
                    setMessage('저장하지 못했습니다. 다시 시도하세요.');
                } finally {
                    setSaving(false);
                }
            }}
            ><Text style={styles.saveText}>{saving ? '저장 중...' : '서버 연결 정보 저장'}</Text></Pressable>
            {!!message && <Text style={{ color: c.subText, fontFamily: 'Pretendard-Regular', fontSize: wide * 2.7, marginTop: wide * 2 }}>{message}</Text>}
        </View>
    );
}

export default function ServerSetting() {
    const { getServerById } = useServerAddress()
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { width, height } = useWindowDimensions(); const wide = Math.min(Math.min(width, height) * 0.01, 4);
    const { isDark } = useTheme(); const c = isDark ? Colors.dark : Colors.light;
    const { deleteServerConfig } = useServerAddress();
    const server = getServerById(id) as ServerConfig
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const deleteServer = () => {
        setShowDeleteModal(false);
        if (server) deleteServerConfig(server.id);
        router.dismissTo('/');
    };

    if (server === undefined) return

    return (
        <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }}>
            <View style={{ paddingTop: 2 }}>
                <BackButton onPress={() => router.back()} color={c.main.text} backgroundColor={isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'} />
            </View>
            <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: 25, color: c.main.text, marginTop: 20 }}>{server.name} 설정</Text>
            <Text style={[styles.heading, { color: c.subText, marginTop: 22 }]}>센서 및 데이터 보관</Text>
            <ServerRuntimeSettings key={id} server={server} wide={wide} c={c} />
            <Text style={[styles.heading, { color: c.subText, marginTop: 22 }]}>서버 연결</Text>
            <View style={[styles.card, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4, marginBottom: wide * 3, paddingTop: 0 }]}><ServerAddressForm key={id} server={server} wide={wide} c={c}></ServerAddressForm></View>
            <Text style={[styles.heading, { color: c.subText, marginTop: 22 }]}>안내</Text>
            <View style={[styles.card, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4 }]}>
                <Text style={[styles.guide, { color: c.subText }]}>1. 서버 주소는 포트까지 입력하세요. 예: http://192.168.0.10:3000</Text>
                <Text style={[styles.guide, { color: c.subText }]}>2. API 키는 서버의 SMARTFARM_API_KEY와 동일해야 설정 변경과 데이터 삭제가 가능합니다.</Text>
                <Text style={[styles.guide, { color: c.subText }]}>3. 최근 센서 상태는 휴대폰에도 저장되어, 연결이 끊겨도 마지막 동기화 값을 확인할 수 있습니다.</Text>
                <Text style={[styles.guide, { color: c.subText }]}>4. 제출·배포 전 실제 센서 측정, 앱 설정 변경, 서버 저장 파일을 한 번씩 확인하세요.</Text>
            </View>
            <Pressable onPress={() => setShowDeleteModal(true)} style={[styles.deleteButton, { backgroundColor: c.red.text }]}>
                <Text>서버 삭제</Text>
            </Pressable>
            <ConfirmModal visible={showDeleteModal} title="서버 삭제" message={`${server.name} 서버를 삭제하시겠습니까? 저장된 연결 정보도 이 기기에서 삭제됩니다.`} confirmLabel="삭제" destructive onCancel={() => setShowDeleteModal(false)} onConfirm={deleteServer} c={c} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center' },
    card: { borderWidth: 1, borderRadius: 8, marginBottom: 10 }, heading: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, marginBottom: 8 },
    label: { fontFamily: 'Pretendard-Regular', marginTop: 12, marginBottom: 5 }, input: { fontFamily: 'Pretendard-Medium', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    saveButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 7, paddingVertical: 10, marginTop: 12 }, saveText: { color: '#FFFFFF', fontFamily: 'Pretendard-Bold' }, fixedValue: { fontFamily: 'Pretendard-Medium', borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 10 },
    deleteButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 7, paddingVertical: 10, marginTop: 10, borderWidth: 1 }, deleteText: { fontFamily: 'Pretendard-Bold' }, guide: { fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 20, marginBottom: 8 },
    disabled: { opacity: 0.4 }
});
