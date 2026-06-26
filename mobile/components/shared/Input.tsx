import { IconEye, IconEyeOff } from '@tabler/icons-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

interface InputProps {
  label?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: 'text' | 'phone' | 'password';
  textContentType?: 'newPassword' | 'password';
}

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  className,
  type = 'text',
  textContentType = 'password',
}: InputProps) {
  const [isVisible, setIsVisible] = useState(type !== 'password');
  const base = 'w-full rounded-lg px-3 h-12 bg-slate-100';

  switch (type) {
    case 'phone': {
      return (
        <View className="gap-y-2">
          {label && <Text className="font-medium">Phone Number</Text>}
          <View className="w-full flex-row gap-x-2">
            <View className="h-12 items-center justify-center rounded-lg bg-slate-100 px-3">
              <Text>+20</Text>
            </View>
            <TextInput
              keyboardType="number-pad"
              placeholder={placeholder}
              value={value}
              onChangeText={onChangeText}
              className={`h-12 flex-1 rounded-lg bg-slate-100 px-3 ${className ? className : ''}`}
            />
          </View>
        </View>
      );
    }
    case 'password': {
      return (
        <View className="gap-y-2">
          {label && <Text className="font-medium">{label}</Text>}
          <View className="w-full flex-row overflow-hidden rounded-lg">
            <TextInput
              secureTextEntry={!isVisible}
              textContentType={textContentType}
              autoComplete="password"
              placeholder={placeholder}
              value={value}
              onChangeText={onChangeText}
              className={`h-12 flex-1 bg-slate-100 px-3 ${className ? className : ''}`}
            />
            <Pressable
              onPress={() => setIsVisible((v) => !v)}
              className="h-12 items-center justify-center bg-slate-100 px-3">
              {isVisible ? (
                <IconEyeOff size={20} color="#AAAAAA" />
              ) : (
                <IconEye size={20} color="#AAAAAA" />
              )}
            </Pressable>
          </View>
        </View>
      );
    }
    case 'text': {
      return (
        <View className="gap-y-2">
          {label && <Text className="font-medium">{label}</Text>}
          <TextInput
            placeholder={placeholder}
            value={value}
            onChangeText={onChangeText}
            className={`${base} ${className ? className : ''}`}
          />
        </View>
      );
    }
  }
}
