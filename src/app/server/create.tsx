import { Colors } from '@/constants/Colors';
import { BackButton } from '@/components/BackButton';
import { FormField } from '@/components/FormField';
import { useServerAddress } from '@/hooks/useServerAddress';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function CreateServer() {
    const router = useRouter();
    const { width, height } = useWindowDimensions(); const wide = Math.min(width, height) * 0.01;
    const { isDark } = useTheme(); const c = isDark ? Colors.dark : Colors.light;

    const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [address, setAddress] = useState(''); const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const { addServerConfig, setServerApiKey } = useServerAddress();
    const disabled = saving || name.trim() === '' || address.trim().replace(/\/$/, '') === '';

    async function create() {
        setSaving(true);
        try {
            const serverId = addServerConfig(name.trim(), description.trim(), address.trim().replace(/\/$/, ''));
            await setServerApiKey(serverId, apiKey.trim());
            router.back();
        } catch {
            setMessage('서버 연결 정보 저장에 실패했습니다. 다시 시도하세요.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: wide * 5, paddingBottom: wide * 22 }}>
            <View style={{ paddingTop: wide * 3}}>
                <BackButton onPress={() => router.back()} color={c.main.text} backgroundColor={isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'} />
            </View>
            <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: wide * 7, color: c.main.text, marginTop: wide * 7 }}>서버 생성하기</Text>
            <Text style={[styles.heading, { color: c.subText, marginTop: wide * 3 }]}>서버 연결</Text>
            <View style={[styles.card, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4, marginBottom: wide * 3, paddingTop: 0 }]}>
                <FormField label="이름" value={name} onChangeText={setName} textColor={c.main.text} borderColor={name ? c.main.outline : c.red.outline} labelColor={c.subText} placeholder="(필수)" placeholderColor={c.red.outline} />
                <FormField label="설명" value={description} onChangeText={setDescription} textColor={c.main.text} borderColor={c.main.outline} labelColor={c.subText} />
                <FormField label="주소" value={address} onChangeText={setAddress} textColor={c.main.text} borderColor={address ? c.main.outline : c.red.outline} labelColor={c.subText} placeholder="(필수)" placeholderColor={c.red.outline} autoCapitalize="none" />
                <FormField label="서버 API 키" value={apiKey} onChangeText={setApiKey} textColor={c.main.text} borderColor={c.main.outline} labelColor={c.subText} placeholder="(설정 변경·삭제용)" placeholderColor={c.subText} secureTextEntry autoCapitalize="none" />
            </View>
            <Text style={[styles.heading, { color: c.subText, marginTop: wide * 3 }]}>주의 사항</Text>
            <View style={[styles.card, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4 }]}>
                <Text style={[styles.guide, { color: c.subText }]}>1. 서버 주소는 포트까지 입력하세요. 예: http://192.168.0.10:3000</Text>
                <Text style={[styles.guide, { color: c.subText }]}>2. API 키는 서버의 SMARTFARM_API_KEY와 동일해야 설정 변경과 데이터 삭제가 가능합니다.</Text>
                <Text style={[styles.guide, { color: c.subText }]}>3. 최근 센서 상태는 휴대폰에도 저장되어, 연결이 끊겨도 마지막 동기화 값을 확인할 수 있습니다.</Text>
                <Text style={[styles.guide, { color: c.subText }]}>4. 제출·배포 전 실제 센서 측정, 앱 설정 변경, 서버 저장 파일을 한 번씩 확인하세요.</Text>
            </View>
            <Pressable onPress={create} disabled={disabled} style={[styles.saveButton, disabled ? styles.disabled : {}, { backgroundColor: c.accent }]}>
                <Text style={styles.saveText}>{saving ? '저장 중...' : '서버 생성하기'}</Text>
            </Pressable>
            {!!message && <Text style={[styles.guide, { color: c.red.text }]}>{message}</Text>}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 16, marginBottom: 12 }, heading: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, marginBottom: 10 },
    saveButton: { alignItems: 'center', borderRadius: 8, paddingVertical: 10, marginTop: 12 }, saveText: { color: '#FFFFFF', fontFamily: 'Pretendard-Bold' },
    deleteButton: { alignItems: 'center', borderRadius: 8, paddingVertical: 10, marginTop: 10, borderWidth: 1 }, deleteText: { fontFamily: 'Pretendard-Bold' }, guide: { fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 20, marginBottom: 8 },
    disabled: { opacity: 0.4 }
});
