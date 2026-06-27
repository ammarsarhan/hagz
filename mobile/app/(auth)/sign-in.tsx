import {
  View,
  Text,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, useStore } from '@tanstack/react-form';
import { SafeAreaView } from 'react-native-safe-area-context';

import { client } from '@/lib/client';
import { useAuth } from '@/context/AuthContext';
import Input from '@/components/shared/Input';
import Button from '@/components/shared/Button';
import Logo from '@/assets/logos/logo-cropped.svg';
import { saveTokens } from '@/lib/storage';

export default function SignIn() {
  const { setUser } = useAuth();

  const form = useForm({
    defaultValues: {
      phone: '',
      password: ''
    },
    onSubmit: async ({ value }) => {
      const { phone, password } = value;
      const res = await client.auth['sign-in'].$post({ json: { phone: `+20${phone}`, password } });

      if (res.ok) {
        const body = await res.json();
        const { accessToken, refreshToken } = body.data || {};
        
        if (accessToken && refreshToken) await saveTokens(accessToken, refreshToken);
        setUser(body.data.user);
        router.replace('/(tabs)');
      };
    }
  });

  const isPending = useStore(form.store, (state) => state.isSubmitting || state.isValidating);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        className="flex-1 overflow-hidden"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView className="flex-1 items-center justify-center gap-y-8 bg-white p-6">
            <View className="items-center justify-center gap-y-3">
              <Logo width={50} height={50} color={'#000000'} />
              <Text className="text-center text-4xl font-semibold">Sign In to Hagz</Text>
            </View>
            <View className="w-full gap-y-6">
              <form.Field name="phone">
                {(field) => (
                  <Input
                    label="Phone Number"
                    placeholder="e.g. 1023045006"
                    type="phone"
                    value={field.state.value}
                    onChangeText={(text) => field.handleChange(text)}
                  />
                )}
              </form.Field>
              <View className="gap-y-2">
                <form.Field name="password">
                  {(field) => (
                    <Input
                      label="Password"
                      placeholder="Password"
                      type="password"
                      value={field.state.value}
                      onChangeText={(text) => field.handleChange(text)}
                    />
                  )}
                </form.Field>
                <Link href="/">
                  <Text className="text-primary-foreground">Forgot password?</Text>
                </Link>
              </View>
            </View>
            <View className="mt-2 w-full items-center gap-y-6">
              <Button className={`w-full ${!isPending ? "border-primary bg-primary" : "border-primary/50 bg-primary/50"}`} disabled={isPending} onPress={() => form.handleSubmit()}>
                {
                  !isPending ? 
                  <Text className="font-semibold">Sign in</Text> :
                  <ActivityIndicator size="small" color="black" />
                }
              </Button>
              <View className="flex-row gap-x-1">
                <Text>Don&apos;t have an account?</Text>
                <Link href={'/sign-up/introduction'} asChild>
                  <Text className="text-primary-foreground">Create one!</Text>
                </Link>
              </View>
            </View>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}
