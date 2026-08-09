import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import Input from "@/components/shared/Input";
import { IconArrowsUpDown, IconUserPlus } from "@tabler/icons-react-native";
import { Link } from "expo-router";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function Index() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const handleScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const renderHeader = () => (
    <View className="pb-4 gap-y-8" style={{ paddingTop: insets.top / 1.5 }}>
      <View className="flex-row items-center justify-between px-6">
        <View className="gap-y-1 flex-1">
          <Text className="text-4xl font-semibold">Team</Text>
          <Text className="text-gray-500">Manage staff member permissions for your venue.</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1" edges={["top"]}>
      <AnimatedScrollView
        className="flex-1"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        <ScrollView
          horizontal
          contentContainerClassName="my-3 px-6 gap-x-6"
        >
          <Pressable className="gap-y-2 items-center w-20">
            <View className="rounded-full size-14 bg-gray-100 items-center justify-center">
              <Text className="font-medium text-lg">A</Text>
            </View>
            <View className="items-center h-10 justify-center">
              <Text className="font-medium truncate">Ammar</Text>
              <Text className="truncate text-[0.85rem]">(You)</Text>
            </View>
          </Pressable>
          <Pressable className="gap-y-2 items-center w-20">
            <View className="rounded-full size-14 bg-gray-100 items-center justify-center">
              <Text className="font-medium text-lg">Y</Text>
            </View>
            <View className="items-center h-10 justify-center">
              <Text className="font-medium truncate">Yasser</Text>
              <Text className="truncate text-[0.85rem]">(Owner)</Text>
            </View>
          </Pressable>
          <Pressable className="gap-y-2 items-center w-20">
            <View className="rounded-full size-14 bg-gray-100 items-center justify-center">
              <Text className="font-medium text-lg">M</Text>
            </View>
            <View className="items-center h-10 justify-center">
              <Text className="font-medium truncate">Mohamed</Text>
            </View>
          </Pressable>
          <Pressable className="gap-y-2 items-center w-20">
            <View className="rounded-full size-14 bg-gray-100 items-center justify-center">
              <Text className="font-medium text-lg">A</Text>
            </View>
            <View className="items-center h-10 justify-center">
              <Text className="font-medium truncate">Ammar</Text>
            </View>
          </Pressable>
          <Pressable className="gap-y-2 items-center w-20">
            <View className="rounded-full size-14 bg-gray-100 items-center justify-center">
              <Text className="font-medium text-lg">Y</Text>
            </View>
            <View className="items-center h-10 justify-center">
              <Text className="font-medium truncate">Yasser</Text>
            </View>
          </Pressable>
          <Pressable className="gap-y-2 items-center w-20">
            <View className="rounded-full size-14 bg-gray-100 items-center justify-center">
              <Text className="font-medium text-lg">M</Text>
            </View>
            <View className="items-center h-10 justify-center">
              <Text className="font-medium truncate">Mohamed</Text>
            </View>
          </Pressable>
        </ScrollView>
        <View className="px-6 my-2 gap-y-4">
          <Text className="text-gray-500 text-sm">You may add up to 10 staff members per venue & have up to 3 pending invitations at most.</Text>
          <View className="flex-row items-center gap-x-4">
            <View className="flex-1">
              <Input placeholder="Search invitations..."/>
            </View>
            <View className="flex-row items-center gap-x-3">
              <Pressable className="rounded-full bg-gray-100 size-11 items-center justify-center">
                <IconArrowsUpDown width={16} height={16} strokeWidth={2.5}/>
              </Pressable>
            </View>
          </View>
        </View>
      </AnimatedScrollView>
        <View className="absolute bottom-6 right-6">
          <Link href="/(dashboard)/(tabs)/bookings/modal" asChild>
            <Pressable className="rounded-full size-14 items-center justify-center bg-primary">
              <IconUserPlus width={22} height={22} color="#FFFFFF" /> 
            </Pressable>
          </Link>
        </View>
    </SafeAreaView>
  );
}