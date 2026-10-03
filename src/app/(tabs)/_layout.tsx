import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Platform, View } from 'react-native';

function TabIcon({ focused, color, iconName, isDark }: { focused: boolean; color: string; iconName: keyof typeof Ionicons.glyphMap; isDark: boolean }) {
    const scale = useSharedValue(focused ? 1.04 : 0.94);
    const highlight = useSharedValue(focused ? 1 : 0);

    useEffect(() => {
        scale.value = withSpring(focused ? 1.04 : 0.94, { damping: 15, stiffness: 300 });
        highlight.value = withSpring(focused ? 1 : 0, { damping: 18, stiffness: 260 });
    }, [focused, scale, highlight]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }), [scale]);

    const highlightStyle = useAnimatedStyle(() => ({
        opacity: highlight.value,
        transform: [{ scaleX: 0.82 + highlight.value * 0.18 }],
    }), [highlight]);

    return (
        <Animated.View style={[{
            alignItems: 'center',
            justifyContent: 'center',
            width: 42,
            height: 32,
            borderRadius: 9,
        }, animatedStyle]}>
            <Animated.View style={[{
                position: 'absolute',
                width: 36,
                height: 28,
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(135,146,247,0.18)' : 'rgba(88,101,242,0.10)',
            }, highlightStyle]} />
            <Ionicons name={iconName} size={19} color={color} />
        </Animated.View>
    );
}

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
                    return <TabIcon focused={focused} color={color} iconName={iconName} isDark={isDark} />;
                },
            })}
        >
            <Tabs.Screen name="index" options={{ title: '모니터링' }} />
            <Tabs.Screen name="notifications" options={{ title: '알림' }} />
            <Tabs.Screen name="settings" options={{ title: '설정' }} />
        </Tabs>
    );
}
