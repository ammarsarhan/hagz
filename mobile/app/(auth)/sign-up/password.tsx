import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useSignUpForm } from '@/context/forms/SignUpContext';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  StatusBar,
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Password() {
  const { data, setData } = useSignUpForm();
  const isDisabled =
    data.password === '' || data.confirmPassword === '' || data.password !== data.confirmPassword;

  useFocusEffect(
    useCallback(() => {
      return () => Keyboard.dismiss();
    }, [])
  );

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        className="flex-1 overflow-hidden"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="w-full flex-1 bg-white">
            <SafeAreaView className="w-full flex-1 items-center  justify-center p-6">
              <View className="w-full gap-y-10">
                <View className="gap-y-3">
                  <Text className="text-center text-4xl font-semibold">Secure your account</Text>
                  <Text className="text-center text-gray-500">
                    Make sure your password has at least one lowercase and uppercase character, a
                    number, and a special character.
                  </Text>
                </View>
                <View className="w-full gap-y-6">
                  <Input
                    label="Password"
                    placeholder="Min. 8 characters"
                    type="password"
                    textContentType="newPassword"
                    value={data.password}
                    onChangeText={(text) => setData({ ...data, password: text })}
                  />
                  <Input
                    label="Confirm Password"
                    placeholder="Re-enter password"
                    type="password"
                    textContentType="newPassword"
                    value={data.confirmPassword}
                    onChangeText={(text) => setData({ ...data, confirmPassword: text })}
                  />
                </View>
                <Button
                  className={
                    isDisabled
                      ? 'w-full border-gray-200 bg-gray-200'
                      : 'w-full border-primary bg-primary'
                  }>
                  <Text className={`font-semibold ${isDisabled ? 'text-gray-400' : 'text-black'}`}>
                    Create Account
                  </Text>
                </Button>
              </View>
            </SafeAreaView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}
