import { Colors } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Modal, Pressable, Text, View } from 'react-native';

export function ConfirmModal({ visible, title, message, confirmLabel = '확인', onCancel, onConfirm, c, destructive = false }: {
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onCancel: () => void;
    onConfirm: () => void;
    c: typeof Colors.dark;
    destructive?: boolean;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <Pressable
                onPress={onCancel}
                style={{ flex: 1, backgroundColor: 'rgba(15,17,20,0.58)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            >
                <Pressable
                    onPress={event => event.stopPropagation()}
                    style={{ width: '100%', maxWidth: 400, borderRadius: 10, padding: 22, backgroundColor: c.main.cover, borderWidth: 1, borderColor: c.main.outline }}
                >
                    <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: 18, marginBottom: 10, color: c.main.text }}>{title}</Text>
                    <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: c.subText }}>{message}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                        <AnimatedPressable
                            onPress={onCancel}
                            style={{ flex: 1, alignItems: 'center', borderWidth: 1, borderColor: c.main.outline, borderRadius: 7, paddingVertical: 11 }}
                        >
                            <Text style={{ fontFamily: 'Pretendard-SemiBold', color: c.main.text }}>취소</Text>
                        </AnimatedPressable>
                        <AnimatedPressable
                            onPress={onConfirm}
                            style={{ flex: 1, alignItems: 'center', borderRadius: 7, paddingVertical: 11, backgroundColor: destructive ? c.red.text : c.accent }}
                        >
                            <Text style={{ color: '#FFFFFF', fontFamily: 'Pretendard-Bold' }}>{confirmLabel}</Text>
                        </AnimatedPressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}