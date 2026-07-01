import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useSignUpForm } from '@/context/forms/SignUpContext';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StatusBar,
  View,
  Text,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Name() {
  const { data, setData } = useSignUpForm();
  const isDisabled = data.firstName === '' || data.lastName === '';

  useFocusEffect(
    useCallback(() => {
      return () => Keyboard.dismiss();
    }, [])
  );

  const { t } = useTranslation();

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        className="flex-1 overflow-hidden"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1 items-center justify-center p-6">
              <View className="w-full gap-y-10">
                <View className="gap-y-3">
                  <Text className="text-center text-4xl font-semibold">
                    {t('auth.signUp.name.title')}
                  </Text>
                  <Text className="text-center text-gray-500">
                    {t('auth.signUp.name.description')}
                  </Text>
                </View>
                <View className="gap-y-6">
                  <Input
                    label={t('auth.signUp.name.inputs.firstName.label')}
                    placeholder={t('auth.signUp.name.inputs.firstName.placeholder')}
                    value={data.firstName}
                    onChangeText={(text) => setData({ ...data, firstName: text })}
                  />
                  <Input
                    label={t('auth.signUp.name.inputs.lastName.label')}
                    placeholder={t('auth.signUp.name.inputs.lastName.placeholder')}
                    value={data.lastName}
                    onChangeText={(text) => setData({ ...data, lastName: text })}
                  />
                </View>
                <Link href={'/auth/sign-up/phone'} asChild disabled={isDisabled}>
                  <Button
                    className={
                      isDisabled ? 'border-primary/40 bg-primary/40' : 'border-primary bg-primary'
                    }>
                    <Text className="font-semibold">{t('auth.signUp.name.cta.primary')}</Text>
                  </Button>
                </Link>
              </View>
            </SafeAreaView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}
