import { View, Text, StatusBar, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Logo from '@/assets/logos/logo-cropped.svg';
import Input from '@/components/shared/Input';
import { useState } from 'react';
import { Link } from 'expo-router';
import Button from '@/components/shared/Button';

export default function SignIn() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  return (
    <>
      <StatusBar barStyle='dark-content'/>
      <KeyboardAvoidingView
          className="flex-1 overflow-hidden"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView className="flex-1 items-center justify-center bg-white p-6 gap-y-8">
            <View className='gap-y-3 items-center justify-center'>
              <Logo width={50} height={50} color={"#000000"} />
              <Text className='text-4xl font-semibold text-center'>Sign In to Hagz</Text>
            </View>
            <View className='w-full gap-y-6'>
              <Input 
                  label="Phone Number" 
                  placeholder="e.g. 1023045006" 
                  type="phone"
                  value={phone} 
                  onChangeText={(text) => setPhone(text)}
              />
              <View className='gap-y-2'>
                <Input 
                    label="Password" 
                    placeholder="Password" 
                    type="password"
                    value={password} 
                    onChangeText={(text) => setPassword(text)}
                />
                <Link href="/">
                  <Text className='text-primary-foreground'>Forgot password?</Text>
                </Link>
              </View>
            </View>
            <View className='w-full items-center gap-y-6 mt-2'>
              <Button className='bg-primary border-primary w-full'>
                <Text className='font-semibold'>Sign in</Text>
              </Button>
              <View className='flex-row gap-x-1'>
                <Text>Don&apos;t have an account?</Text>
                <Link href={'/sign-up/introduction'} asChild>
                  <Text className='text-primary-foreground'>Create an account</Text>
                </Link>
              </View>
            </View>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}
