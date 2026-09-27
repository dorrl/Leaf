import { Colors } from '@/constants/Colors';
import { useServerAddress } from '@/hooks/useServerAddress';
import { useTheme } from '@/hooks/useTheme';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';

export default function Settings() {
    const { width, height } = useWindowDimensions(); const wide = Math.min(width, height) * 0.01;
    const { isDark, toggleTheme } = useTheme(); const c = isDark ? Colors.dark : Colors.light;
    const { servers } = useServerAddress();
    const [notifications, setNotifications] = useState(true);
    return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: wide * 5, paddingBottom: wide * 22 }}>
        <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: wide * 7, color: c.main.text, marginBottom: wide * 5 }}>설정</Text>
        <View style={[styles.card, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4 }]}>
            <Text style={{ color: c.main.text, fontFamily: 'Pretendard-SemiBold', fontSize: wide * 3.5 }}>다크 모드</Text><Switch value={isDark} onValueChange={toggleTheme} trackColor={{ true: c.accent }} />
            <Text style={{ color: c.main.text, fontFamily: 'Pretendard-SemiBold', fontSize: wide * 3.5, marginTop: wide * 3 }}>알림 표시</Text><Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: c.accent }} />
        </View>
        <View style={[styles.card, { backgroundColor: c.main.cover, borderColor: c.main.outline, padding: wide * 4 }]}>
            <Text style={{ color: c.main.text, fontFamily: 'Pretendard-Bold', fontSize: wide * 5 }}>Credit</Text>
            <Text style={[styles.guide, { color: c.subText }]}>제작: ITEC tech</Text>
            <Text style={[styles.guide, { color: c.subText }]}>언젠간 배포</Text>
            <Text style={[styles.guide, { color: c.subText }]}>아 힘들다</Text>
        </View>
    </ScrollView>;
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 16, marginBottom: 12 }, heading: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, marginBottom: 10 },
    label: { fontFamily: 'Pretendard-Regular', marginTop: 12, marginBottom: 5 }, input: { fontFamily: 'Pretendard-Medium', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    saveButton: { alignItems: 'center', borderRadius: 8, paddingVertical: 10, marginTop: 12 }, saveText: { color: '#FFFFFF', fontFamily: 'Pretendard-Bold' }, fixedValue: { fontFamily: 'Pretendard-Medium', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
    deleteButton: { alignItems: 'center', borderRadius: 8, paddingVertical: 10, marginTop: 10, borderWidth: 1 }, deleteText: { fontFamily: 'Pretendard-Bold' }, guide: { fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 20, marginBottom: 8 },
});
