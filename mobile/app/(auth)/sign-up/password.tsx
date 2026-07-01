import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useAuth } from '@/context/AuthContext';
import { useSignUpForm } from '@/context/forms/SignUpContext';
import { client } from '@/lib/client';
import { convertNumerals } from '@/lib/number';
import { saveTokens } from '@/lib/storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StatusBar,
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Password() {
  const { data, setData } = useSignUpForm();
  const { setUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const isDisabled = data.password === '' || data.confirmPassword === '' || data.password !== data.confirmPassword;

  useFocusEffect(
    useCallback(() => {
      return () => Keyboard.dismiss();
    }, [])
  );

  const handleSubmit = async () => {
    setIsLoading(true);

    const { phone } = data;
    const res = await client.auth['sign-up'].$post({ json: { ...data, phone: `+20${convertNumerals(phone)}` } });

    if (res.ok) {
      const body = await res.json();
      const { accessToken, refreshToken } = body.data || {};
      
      if (accessToken && refreshToken) await saveTokens(accessToken, refreshToken);

      const user = body.data.user;
      setUser(user);
      
      switch (user.preferences.role) {
        case "USER":
          router.replace("(user)/onboarding/introduction");
          break;
        case "MANAGER":
          router.replace("(dashboard)/onboarding/manager/invitations");
          break;
        case "OWNER":
          router.replace("(dashboard)/onboarding/owner/details");
          break;
      }

    }

    setIsLoading(false);
  };

  const { t } = useTranslation();

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        className="flex-1 overflow-hidden"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="w-full flex-1 bg-white">
            <SafeAreaView className="w-full flex-1 items-center  justify-center p-6">
              <View className="w-full gap-y-10">
                <View className="gap-y-3">
                  <Text className="text-center text-4xl font-semibold">{t("auth.signUp.password.title")}</Text>
                  <Text className="text-center text-gray-500">
                    {t("auth.signUp.password.description")}
                  </Text>
                </View>
                <View className="w-full gap-y-6">
                  <Input
                    label="Password"
                    placeholder={t("auth.signUp.password.inputs.password.placeholder")}
                    type="password"
                    textContentType="newPassword"
                    value={data.password}
                    onChangeText={(text) => setData({ ...data, password: text })}
                  />
                  <Input
                    label="Confirm Password"
                    placeholder={t("auth.signUp.password.inputs.confirmPassword.placeholder")}
                    type="password"
                    textContentType="newPassword"
                    value={data.confirmPassword}
                    onChangeText={(text) => setData({ ...data, confirmPassword: text })}
                  />
                </View>
                <Button 
                  className={`w-full ${!isDisabled ? "border-primary bg-primary" : "border-primary/50 bg-primary/50"}`} 
                  disabled={isLoading || isDisabled} 
                  onPress={handleSubmit}
                >
                  {
                    isLoading ? 
                      <ActivityIndicator size="small" color="black" /> : 
                    isDisabled ? 
                      <Text className="font-semibold text-black/50">{t("auth.signUp.password.cta.primary")}</Text> : 
                      <Text className="font-semibold">{t("auth.signUp.password.cta.primary")}</Text>
                  }
                </Button>
              </View>
            </SafeAreaView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}
