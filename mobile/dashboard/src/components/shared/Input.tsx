import { IconEye, IconEyeOff } from '@tabler/icons-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Egypt from '@/assets/static/flags/egypt.svg';

import cn from '@/lib/cn';

interface InputProps {
  label?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  type?: 'text' | 'phone' | 'password';
  textContentType?: 'newPassword' | 'password';
}

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  className,
  containerClassName,
  type = 'text',
  textContentType = 'password',
}: InputProps) {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const [isVisible, setIsVisible] = useState(type !== 'password');

  const base = cn(
    'rounded-lg px-3 h-12 border border-gray-100',
    isRTL ? 'text-right' : 'text-left'
  );

  switch (type) {
    case 'phone': {
      return (
        <View className={cn('gap-y-2', containerClassName)}>
          {label && (
            <Text className="text-left font-medium">
              {t('components.shared.input.phone.label')}
            </Text>
          )}
          <View className="w-full flex-row">
            <View className="h-12 flex-row gap-x-2 items-center justify-center rounded-l-lg border border-gray-100 px-3">
              <Egypt width={20} height={20} />
              <Text>+20</Text>
            </View>
            <TextInput
              keyboardType="number-pad"
              placeholderTextColor="#6B7280"
              placeholder={placeholder}
              value={value}
              onChangeText={onChangeText}
              className={cn(
                'h-12 flex-1 rounded-r-lg border-y border-r border-gray-100 px-3',
                isRTL ? 'text-right' : 'text-left',
                className
              )}
            />
          </View>
        </View>
      );
    }
    case 'password': {
      return (
        <View className={cn('gap-y-2', containerClassName)}>
          {label && (
            <Text className="text-left font-medium">
              {t('components.shared.input.password.label')}
            </Text>
          )}
          <View className="w-full flex-row overflow-hidden border border-gray-100 rounded-lg">
            <TextInput
              secureTextEntry={!isVisible}
              placeholderTextColor="#6B7280"
              textContentType={textContentType}
              autoComplete="password"
              placeholder={placeholder}
              value={value}
              onChangeText={onChangeText}
              className={cn('h-12 flex-1 px-3', isRTL ? 'text-right' : 'text-left', className)}
            />
            <Pressable
              onPress={() => setIsVisible((v) => !v)}
              className="h-12 items-center justify-center px-3">
              {isVisible ? (
                <Animated.View entering={FadeIn} exiting={FadeOut} key="off">
                  <IconEyeOff size={20} color="#AAAAAA" />
                </Animated.View>
              ) : (
                <Animated.View entering={FadeIn} exiting={FadeOut} key="on">
                  <IconEye size={20} color="#AAAAAA" />
                </Animated.View>
              )}
            </Pressable>
          </View>
        </View>
      );
    }
    case 'text': {
      return (
        <View className={cn('gap-y-2', containerClassName)}>
          {label && <Text className="text-left font-medium">{label}</Text>}
          <TextInput
            placeholder={placeholder}
            placeholderTextColor="#6B7280"
            value={value}
            onChangeText={onChangeText}
            className={cn(base, 'w-full', className)}
          />
        </View>
      );
    }
  }
}
