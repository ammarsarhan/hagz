import Input from '@/components/shared/Input';
import { IconChevronLeft } from '@tabler/icons-react-native';
import { Link, router } from 'expo-router';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/shared/Button';
import Logo from '@/assets/logos/logo-cropped.svg';
import { useState } from 'react';
import { client } from '@/lib/client';
import { saveTokens } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';

export default function SignIn() {
  const { setUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async () => {
    const res = await client.auth['sign-in'].$post({ json: { phone: `+20${phone}`, password } });

    if (res.ok) {
      const body = await res.json();
      const { accessToken, refreshToken } = body.data || {};
      
      if (accessToken && refreshToken) await saveTokens(accessToken, refreshToken);
      setUser(body.data.user);
      router.replace('/(tabs)');
    };
  };

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1">
            <Link href="/" asChild>
              <Pressable className="flex-row items-center gap-x-0.5 px-2">
                <IconChevronLeft />
                <Text>Back</Text>
              </Pressable>
            </Link>
            <View className="flex-1 items-center justify-center gap-y-8 p-6">
              <View className="flex-col gap-y-3">
                <Logo width={40} height={40} />
                <Text className="mt-2 text-4xl font-semibold">Sign In to Hagz</Text>
                <Text className="text-gray-500">
                  Log back in to your account to explore and book venues.
                </Text>
              </View>
              <View className="w-full gap-y-4">
                <Input placeholder="Phone" type="phone" label="Phone" value={phone} onChangeText={(value) => setPhone(value)}/>
                <Input placeholder="Password" type="password" label="Password" value={password} onChangeText={(value) => setPassword(value)} />
                <View>
                  <Link href="/" className="text-primary-foreground">
                    Forgot password?
                  </Link>
                </View>
              </View>
              <Button className="w-1/2 border-primary bg-primary" onPress={handleSignIn}>
                <Text className="font-medium">Sign In</Text>
              </Button>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <View className="w-full flex-row flex-wrap items-center justify-center gap-x-1 pb-4 text-sm">
        <Text className="text-[0.95rem] text-gray-500">Don&apos;t have an account yet?</Text>
        <Link href="/sign-up" className="text-[0.95rem] text-primary-foreground">
          Create one
        </Link>
      </View>
    </SafeAreaView>
  );
}
