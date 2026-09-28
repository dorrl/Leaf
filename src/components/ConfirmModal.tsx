import { Colors } from '@/constants/Colors';
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
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            >
                <Pressable
                    onPress={event => event.stopPropagation()}
                    style={{ width: '100%', maxWidth: 380, borderRadius: 16, padding: 20, backgroundColor: c.main.cover }}
                >
                    <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: 18, marginBottom: 10, color: c.main.text }}>{title}</Text>
                    <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: c.subText }}>{message}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                        <Pressable
                            onPress={onCancel}
                            style={{ flex: 1, alignItems: 'center', borderWidth: 1, borderColor: c.main.outline, borderRadius: 8, paddingVertical: 11 }}
                        >
                            <Text style={{ fontFamily: 'Pretendard-SemiBold', color: c.main.text }}>취소</Text>
                        </Pressable>
                        <Pressable
                            onPress={onConfirm}
                            style={{ flex: 1, alignItems: 'center', borderRadius: 8, paddingVertical: 11, backgroundColor: destructive ? c.red.text : c.green.text }}
                        >
                            <Text style={{ color: '#FFFFFF', fontFamily: 'Pretendard-Bold' }}>{confirmLabel}</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}