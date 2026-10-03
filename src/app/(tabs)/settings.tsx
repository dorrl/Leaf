import { Colors } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useTheme } from '@/hooks/useTheme';
import { AntDesign } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

async function openURL(url: string) {
    const supported = await Linking.canOpenURL(url)
    if (supported) await Linking.openURL(url)
    else return
}

export default function Settings() {
    const { isDark, toggleTheme } = useTheme(); const c = isDark ? Colors.dark : Colors.light;
    const [notifications, setNotifications] = useState(true);
    return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 100 }}>
        <View style={{ marginBottom: 20 }}>
            <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: 25, color: c.main.text }}>설정</Text>
            <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: 13, color: c.subText, marginTop: 4 }}>앱 표시와 알림 환경</Text>
        </View>
        <View style={[styles.settingsList, { backgroundColor: c.main.cover, borderColor: c.main.outline }]}>
            <View style={styles.settingRow}>
                <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={[styles.settingTitle, { color: c.main.text }]}>다크 모드</Text>
                    <Text style={[styles.settingDescription, { color: c.subText }]}>앱 테마를 어둡게 표시합니다</Text>
                </View>
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ true: c.accent }} />
            </View>
            <View style={[styles.divider, { backgroundColor: c.main.outline }]} />
            <View style={styles.settingRow}>
                <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={[styles.settingTitle, { color: c.main.text }]}>알림 표시</Text>
                    <Text style={[styles.settingDescription, { color: c.subText }]}>기기의 알림 표시를 켭니다</Text>
                </View>
                <Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: c.accent }} />
            </View>
        </View>
        <View style={{ marginTop: 28 }}>
            <Text style={{ fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: c.subText, marginBottom: 8 }}>앱 정보</Text>
            <Text style={{ fontFamily: 'Pretendard-Medium', fontSize: 13, color: c.main.text }}>Smart Farm · ITEC tech</Text>
        </View>
        <View style={{marginTop: 5, flexDirection: 'row'}}>
            <AnimatedPressable onPress={() => openURL('https://itec.dorrl.com/')} style={[styles.redirectButton, {backgroundColor: c.main.cover, borderColor: c.main.outline}]}>
                <AntDesign name="link" size={30} color={c.main.text} />
            </AnimatedPressable>
            <AnimatedPressable onPress={() => openURL('https://github.com/dorrl/farmApp')} style={[styles.redirectButton, {backgroundColor: c.main.cover, borderColor: c.main.outline}]}>
                <AntDesign name="github" size={30} color={c.main.text} />
            </AnimatedPressable>

        </View>
    </ScrollView>;
}

const styles = StyleSheet.create({
    settingsList: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16 },
    settingRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 14 },
    settingDescription: { fontFamily: 'Pretendard-Regular', fontSize: 12, marginTop: 3 },
    divider: { height: 1 },
    redirectButton: {width: 40, height: 40, borderRadius: 8, marginRight: 10,justifyContent: 'center', alignItems: 'center', borderWidth: 1}
});
