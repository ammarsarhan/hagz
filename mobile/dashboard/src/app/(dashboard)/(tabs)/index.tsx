import Avatar from "@/components/shared/Avatar";
import { usePitch } from "@/context/PitchContext";
import { IconBell, IconQrcode } from "@tabler/icons-react-native";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDate } from "date-fns";
import { useDashboardHome } from "@/lib/hooks/useDashboardHome";

export default function Index() {
  const { pitch, isLoading } = usePitch();

  const {
    data: home,
    isLoading: isHomeLoading,
    refetch,
    isRefetching,
  } = useDashboardHome(pitch?.id ?? "", !!pitch?.id);

  if (isLoading || isHomeLoading || !home) 
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );

  return (
    <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-y-10 pb-10"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#1C04EA"
            colors={["#1C04EA"]}
          />
        }
      >
        <View className="px-6 pt-6 gap-y-6">
          <View className="flex-row items-center justify-between">
            <Link href="/(dashboard)/profile">
              <Avatar />
            </Link>
            <View className="flex-row items-center gap-x-3">
              <Pressable className="size-12 items-center justify-center rounded-full bg-gray-100">
                <IconBell size={20} color="#000"/>
              </Pressable>
              <Pressable className="size-12 items-center justify-center rounded-full bg-gray-100">
                <IconQrcode size={20} color="#000"/>
              </Pressable>
            </View>
          </View>
          <View className="gap-y-1.5">
            <Text className="text-4xl font-semibold">{home.pitch.name}</Text>
            <Text className="text-gray-500">{formatDate(new Date(), "dd MMM")}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
