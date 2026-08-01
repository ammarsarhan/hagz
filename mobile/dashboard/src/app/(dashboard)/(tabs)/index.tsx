import Avatar from "@/components/shared/Avatar";
import { usePitch } from "@/context/PitchContext";
import { IconBell, IconQrcode } from "@tabler/icons-react-native";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const { pitch, isLoading } = usePitch();
  if (isLoading) return null;

  return (
    <SafeAreaView className="flex-1 gap-y-6">
      <View className="px-6 pt-6 flex-row items-center justify-between">
        <Link href="/(dashboard)/profile">
          <Avatar />
        </Link>
        <View className="flex-row items-center gap-x-3">
          <Pressable className="size-12 items-center justify-center rounded-full bg-gray-100">
            <IconBell size={20} />
          </Pressable>
          <Pressable className="size-12 items-center justify-center rounded-full bg-gray-100">
            <IconQrcode size={20} />
          </Pressable>
        </View>
      </View>
      <View className="gap-y-4 px-6">
        <Text className="text-4xl font-semibold">{pitch.name}</Text>
      </View>
    </SafeAreaView>
  );
}
