import Input from '@/components/shared/Input';
import { IconChevronLeft } from '@tabler/icons-react-native';
import { Link } from 'expo-router';
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

export default function SignIn() {
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
                <Input placeholder="Phone" type="phone" label="Phone" />
                <Input placeholder="Password" type="password" label="Password" />
                <View>
                  <Link href="/" className="text-primary-foreground">
                    Forgot password?
                  </Link>
                </View>
              </View>
              <Button className="w-1/2 border-primary bg-primary">
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
