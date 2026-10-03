import { TextInput, Text, View, type TextInputProps } from 'react-native';

type FormFieldProps = Pick<TextInputProps, 'autoCapitalize' | 'keyboardType' | 'secureTextEntry'> & {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    textColor: string;
    borderColor: string;
    labelColor: string;
    placeholder?: string;
    placeholderColor?: string;
};

export function FormField({
    label,
    value,
    onChangeText,
    textColor,
    borderColor,
    labelColor,
    placeholder,
    placeholderColor,
    autoCapitalize,
    keyboardType,
    secureTextEntry,
}: FormFieldProps) {
    return (
        <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: 'Pretendard-Medium', marginTop: 14, marginBottom: 6, color: labelColor, fontSize: 12 }}>
                {label}
            </Text>
            <TextInput
                style={{
                    fontFamily: 'Pretendard-Medium',
                    minHeight: 44,
                    borderWidth: 1,
                    borderRadius: 7,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: textColor,
                    borderColor,
                    backgroundColor: 'transparent',
                }}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                autoCapitalize={autoCapitalize}
                keyboardType={keyboardType}
                secureTextEntry={secureTextEntry}
            />
        </View>
    );
}