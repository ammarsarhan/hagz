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
                    What should we call you?
                  </Text>
                  <Text className="text-center text-gray-500">
                    Preferably, use your first and last name as they appear on your ID.
                  </Text>
                </View>
                <View className="gap-y-6">
                  <Input
                    label="First Name"
                    placeholder="e.g. Ammar"
                    value={data.firstName}
                    onChangeText={(text) => setData({ ...data, firstName: text })}
                  />
                  <Input
                    label="Last Name"
                    placeholder="e.g. Yasser"
                    value={data.lastName}
                    onChangeText={(text) => setData({ ...data, lastName: text })}
                  />
                </View>
                <Link asChild href={'/sign-up/phone'} disabled={isDisabled}>
                  <Button
                    className={
                      isDisabled ? 'border-primary/40 bg-primary/40' : 'border-primary bg-primary'
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
