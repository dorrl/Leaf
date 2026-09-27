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
        <View>
            <Text style={{ fontFamily: 'Pretendard-Regular', marginTop: 12, marginBottom: 5, color: labelColor }}>
                {label}
            </Text>
            <TextInput
                style={{
                    fontFamily: 'Pretendard-Medium',
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: textColor,
                    borderColor,
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