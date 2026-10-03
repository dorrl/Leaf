import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';

export default function TabsLayout() {
    const { isDark } = useTheme();
    const c = isDark ? Colors.dark : Colors.light;

    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerShown: false,
                navigationBarHidden: true,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: Platform.OS === 'ios' ? 82 : 62,
                    backgroundColor: c.tab.bg,
                    borderTopColor: isDark ? '#3F4147' : '#DCDDDF',
                    borderTopWidth: 1,
                    elevation: 0,
                    paddingBottom: Platform.OS === 'ios' ? 22 : 0,
                    paddingTop: 4,
                },
                tabBarActiveTintColor: c.tab.active,
                tabBarInactiveTintColor: c.tab.inactive,
                tabBarLabelStyle: {
                    fontFamily: 'Pretendard-Medium',
                    fontSize: 11,
                    marginTop: 1,
                },
                tabBarItemStyle: {
                    paddingVertical: 3,
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'home';
                    if (route.name === 'index') {
                        iconName = focused ? 'leaf' : 'leaf-outline';
                    } else if (route.name === 'notifications') {
                        iconName = focused ? 'notifications' : 'notifications-outline';
                    } else if (route.name === 'settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }
                    return (
                        <View style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 28,

                            borderRadius: 7,
                            backgroundColor: focused
                                ? (isDark ? 'rgba(135,146,247,0.18)' : 'rgba(88,101,242,0.1)')
                                : 'transparent',
                        }}>
                            <Ionicons name={iconName} size={19} color={color} />
                        </View>
                    );
                },
            })}
        >
            <Tabs.Screen name="index" options={{ title: '모니터링' }} />
            <Tabs.Screen name="notifications" options={{ title: '알림' }} />
            <Tabs.Screen name="settings" options={{ title: '설정' }} />
        </Tabs>
    );
}
