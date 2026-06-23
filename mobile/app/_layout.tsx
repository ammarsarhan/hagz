import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from '@/components/shared/Button';

import '../global.css';
import { IconBallFootball, IconX } from '@tabler/icons-react-native';
import Logo from '@/assets/logos/logo-cropped.svg';

export default function RootLayout() {
  const [isModalOpen, setIsModalOpen] = useState(true);

  const handleRedirect = (route: string) => {
    setIsModalOpen(false);
    router.push(route);
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
      <Modal
          visible={isModalOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsModalOpen(false)}
      >
          <SafeAreaView className="flex-1 bg-white p-6">
              <Pressable onPress={() => setIsModalOpen(false)} className="absolute top-4 right-4">
                  <IconX/>
              </Pressable>
              <View className="absolute top-1/3 -translate-y-1/2 -right-48 opacity-5">
                  <IconBallFootball width={400} height={400}/>
              </View>
              <View className="flex-1 gap-y-10 w-full justify-end">
                  <View className="gap-y-3">
                      <View className="items-center justify-center size-14 bg-primary rounded-md mb-2">
                          <Logo width={24} height={24} color={"#1F4F33"}/>
                      </View>
                      <Text className="text-4xl font-semibold mt-2">Find & Book Nearby Pitches</Text>
                      <Text className="text-gray-500">Sign in to your account or create a new account to get started!</Text>
                  </View>
                  <View className="gap-y-2">
                      <Button className="border-primary bg-primary" onPress={() => handleRedirect("/sign-in")}>
                        <Text className="font-medium">Sign In With Phone</Text>    
                      </Button>
                      <View className="flex-row items-center gap-x-8 py-3 px-4">
                          <View className="h-0.5 bg-gray-100 flex-1 rounded-full"></View>
                          <Text className="text-sm text-gray-500 text-center">Or</Text>
                          <View className="h-0.5 bg-gray-100 flex-1 rounded-full"></View>
                      </View>
                      <Button className="bg-card-foreground" onPress={() => handleRedirect("/sign-up")}>
                        <Text className="text-card font-medium">Create Account</Text>    
                      </Button>
                  </View>
              </View>
          </SafeAreaView>
      </Modal>
    </>
  );
}
