import { useState } from 'react';
import { router } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

import Button from '@/components/shared/Button';

import '../global.css';
import { IconBallFootball, IconX } from '@tabler/icons-react-native';
import Logo from '@/assets/logos/logo-cropped.svg';

export default function AuthModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(!user ? true : false);

  const handleRedirect = (route: string) => {
    setIsOpen(false);
    router.push(route);
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setIsOpen(false)}
    >
      <SafeAreaView className="flex-1 bg-white p-6">
        <Pressable onPress={() => setIsOpen(false)} className="absolute right-4 top-4">
          <IconX />
        </Pressable>
        <View className="absolute -right-48 top-1/3 -translate-y-1/2 opacity-5">
          <IconBallFootball width={400} height={400} />
        </View>
        <View className="w-full flex-1 justify-end gap-y-10">
          <View className="gap-y-3">
            <View className="mb-2 size-14 items-center justify-center rounded-md bg-primary">
              <Logo width={24} height={24} color={'#1F4F33'} />
            </View>
            <Text className="mt-2 text-4xl font-semibold">Find & Book Nearby Pitches</Text>
            <Text className="text-gray-500">
              Sign in to your account or create a new account to get started!
            </Text>
          </View>
          <View className="gap-y-2">
            <Button
              className="border-primary bg-primary"
              onPress={() => handleRedirect('/sign-in')}
            >
              <Text className="font-semibold">Sign In With Phone</Text>
            </Button>
            <View className="flex-row items-center gap-x-8 px-4 py-3">
              <View className="h-0.5 flex-1 rounded-full bg-gray-100"></View>
              <Text className="text-center text-sm text-gray-500">Or</Text>
              <View className="h-0.5 flex-1 rounded-full bg-gray-100"></View>
            </View>
            <Button className="bg-card-foreground" onPress={() => handleRedirect('/sign-up/introduction')}>
              <Text className="font-semibold text-card">Create Account</Text>
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}