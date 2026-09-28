import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

export default function TabsLayout() {
    const { isDark } = useTheme();
    const c = isDark ? Colors.dark : Colors.light;

    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: Platform.OS === 'ios' ? 24 : 16,
                    left: 24,
                    right: 24,
                    borderRadius: 28,
                    height: 68,
                    backgroundColor: c.tab.bg,
                    borderTopWidth: 0,
                    elevation: 0,
                    shadowColor: isDark ? '#4ADE80' : '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.2 : 0.1,
                    shadowRadius: 20,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: c.tab.active,
                tabBarInactiveTintColor: c.tab.inactive,
                tabBarLabelStyle: {
                    fontFamily: 'Pretendard-Medium',
                    fontSize: 11,
                    marginTop: 2,
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
                            width: 40,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: focused
                                ? (isDark ? 'rgba(74,222,128,0.15)' : 'rgba(34,197,94,0.12)')
                                : 'transparent',
                        }}>
                            <Ionicons name={iconName} size={22} color={color} />
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
