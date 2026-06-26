import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useSignUpForm } from '@/context/forms/SignUpContext';
import { Link, useFocusEffect } from 'expo-router';
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

export default function Phone() {
  const { data, setData } = useSignUpForm();
  const isDisabled = data.phone === '';

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
                  <Text className="text-center text-4xl font-semibold">Your phone number</Text>
                  <Text className="text-center text-gray-500">
                    We&apos;ll use your number to send booking confirmations and reminders via
                    WhatsApp.
                  </Text>
                </View>
                <View className="w-full gap-y-6">
                  <Input
                    label="Phone Number"
                    placeholder="e.g. 1023045006"
                    type="phone"
                    value={data.phone}
                    onChangeText={(text) => setData({ ...data, phone: text })}
                  />
                </View>
                <Link asChild href={'/sign-up/password'} disabled={isDisabled}>
                  <Button
                    className={
                      isDisabled
                        ? 'w-full border-primary/40 bg-primary/40'
                        : 'w-full border-primary bg-primary'
                    }>
                    <Text className="font-semibold">Next</Text>
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
