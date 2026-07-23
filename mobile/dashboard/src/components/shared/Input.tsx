import { IconEye, IconEyeOff, IconInfoCircle } from '@tabler/icons-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Egypt from '@/assets/static/flags/egypt.svg';

import cn from '@/lib/cn';

interface InputProps {
  label?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  type?: 'text' | 'phone' | 'password' | 'number' | 'price';
  textContentType?: 'newPassword' | 'password';
  multiline?: boolean;
  numberOfLines?: number;
  minHeight?: number;
  information?: string;
  isDetailed?: boolean;
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
  multiline = false,
  numberOfLines,
  minHeight = 96,
  information,
  isDetailed = false
}: InputProps) {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const [isVisible, setIsVisible] = useState(type !== 'password');
  const [isInformation, setIsInformation] = useState(isDetailed);

  switch (type) {
    case 'phone': {
      return (
        <View className={cn('w-full gap-y-2', containerClassName)}>
          {label && (
            <Text className="text-left font-medium">
              {t('components.shared.input.phone.label')}
            </Text>
          )}
          <View className="w-full flex-row">
            <View className="min-h-[48px] flex-row gap-x-2 items-center justify-center rounded-l-lg border border-gray-100 px-3">
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
                'min-h-[48px] flex-1 rounded-r-lg border-y border-r border-gray-100 px-3 py-3',
                isRTL ? 'text-right' : 'text-left',
                className
              )}
            />
          </View>
        </View>
      );
    }
    case 'price': {
      return (
        <Animated.View
          layout={LinearTransition.duration(200)}
          className={cn('w-full gap-y-2', containerClassName)}
        >
          {
            (label || information) && (
              <View className="flex-row items-center gap-x-2">
                {!!label && <Text className="text-left font-medium">{label}</Text>}
                {!!information && (
                  <Pressable onPress={() => setIsInformation((prev) => !prev)}>
                    <IconInfoCircle width={20} height={20} color="#6B7280" />
                  </Pressable>
                )}
              </View>
            )
          }
          <View className="w-full flex-row">
            <View className="min-h-[48px] flex-row items-center justify-center rounded-l-lg border-y border-l border-gray-100 pl-3">
              <Text className="text-gray-500">EGP</Text>
            </View>
            <TextInput
              keyboardType="numeric"
              placeholderTextColor="#6B7280"
              placeholder={placeholder}
              value={value}
              onChangeText={onChangeText}
              className={cn(
                'min-h-[48px] flex-1 rounded-r-lg border-y border-r border-gray-100 pl-2 pr-3 py-3',
                isRTL ? 'text-right' : 'text-left',
                className
              )}
            />
          </View>
          {
            isInformation && (
              <Animated.View
                entering={FadeIn}
                exiting={FadeOut}
                layout={LinearTransition.duration(200)}
                className="pb-1"
              >
                <Text className="text-sm text-gray-500">{information}</Text>
              </Animated.View>
            )
          }
        </Animated.View>
      );
    }
    case 'password': {
      return (
        <View className={cn('w-full gap-y-2', containerClassName)}>
          {
            label && (
              <Text className="text-left font-medium">
                {t('components.shared.input.password.label')}
              </Text>
            )
          }
          <View className="w-full flex-row items-center overflow-hidden border border-gray-100 rounded-lg min-h-[48px]">
            <TextInput
              secureTextEntry={!isVisible}
              placeholderTextColor="#6B7280"
              textContentType={textContentType}
              autoComplete="password"
              placeholder={placeholder}
              value={value}
              onChangeText={onChangeText}
              className={cn('flex-1 px-3 py-3', isRTL ? 'text-right' : 'text-left', className)}
            />
            <Pressable
              onPress={() => setIsVisible((v) => !v)}
              className="h-12 items-center justify-center px-3">
              {
                isVisible ? (
                  <Animated.View entering={FadeIn} exiting={FadeOut} key="off">
                    <IconEyeOff size={20} color="#AAAAAA" />
                  </Animated.View>
                ) : (
                  <Animated.View entering={FadeIn} exiting={FadeOut} key="on">
                    <IconEye size={20} color="#AAAAAA" />
                  </Animated.View>
                )
              }
            </Pressable>
          </View>
        </View>
      );
    }
    case 'text':
    case 'number': {
      return (
        <Animated.View
          layout={LinearTransition.duration(200)}
          className={cn('w-full gap-y-2', containerClassName)}
        >
          {
          (label || information) && (
            <View className="flex-row items-center gap-x-2">
              {!!label && <Text className="text-left font-medium">{label}</Text>}
              {!!information && (
                <Pressable onPress={() => setIsInformation((prev) => !prev)}>
                  <IconInfoCircle width={20} height={20} color="#6B7280" />
                </Pressable>
              )}
            </View>
          )
          }
          <View className="w-full flex-row">
            <TextInput
              keyboardType={type === 'number' ? 'number-pad' : 'default'}
              placeholder={placeholder}
              placeholderTextColor="#6B7280"
              value={value}
              onChangeText={onChangeText}
              multiline={multiline}
              numberOfLines={multiline ? numberOfLines : 1}
              scrollEnabled={!multiline}
              textAlignVertical={multiline ? 'top' : 'center'}
              style={{ minHeight: multiline ? minHeight : 48 }}
              className={cn(
                'flex-1 rounded-lg border border-gray-100 px-3 py-3',
                isRTL ? 'text-right' : 'text-left',
                className
              )}
            />
          </View>
          {
            isInformation &&
            <Animated.View
              entering={FadeIn}
              exiting={FadeOut}
              layout={LinearTransition.duration(200)}
              className="pb-1"
            >
              <Text className="text-sm text-gray-500">{information}</Text>
            </Animated.View>
          }
        </Animated.View>
      );
    }
  }
};
