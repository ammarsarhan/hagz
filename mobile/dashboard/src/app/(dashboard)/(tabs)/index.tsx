import Avatar from "@/components/shared/Avatar";
import { usePitch } from "@/context/PitchContext";
import { IconBell, IconChevronRight, IconQrcode } from "@tabler/icons-react-native";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LineGraph } from "react-native-graph";
import HomeCard from "@/components/tabs/HomeCard";
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

  const trendPoints = home.overview.trend.map((point) => ({
    date: new Date(point.date),
    value: point.value,
  }));

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
          <View className="gap-y-1">
            <Text className="text-4xl font-semibold">{home.pitch.name}</Text>
            <Text>{formatDate(new Date(), "dd MMM")}</Text>
          </View>
        </View>
        <View className="px-6 gap-y-4 mb-2">
          <Text className="font-medium text-[1.1rem]">Overview</Text>
          <View className="gap-y-6">
            <View className="p-5 bg-gray-100 rounded-lg flex-row items-center gap-x-6">
              <View className="flex-1 gap-y-16">
                <Text className="font-medium">Today&apos;s Bookings</Text>
                <View>
                  <Text className="text-6xl font-semibold mb-0.5">{home.overview.bookedHours}h</Text>
                  <Text className="mb-0.5">Booked</Text>
                  <Text>Venue-wide</Text>
                </View>
              </View>
              <View className="flex-1">
                <LineGraph
                  points={trendPoints}
                  animated
                  color="#1C04EA"
                  gradientFillColors={["#1C04EA30", "#1C04EA00"]}
                  enablePanGesture={false}
                  style={{
                    width: "100%",
                    height: 140,
                  }}
                />
              </View>
            </View>
            <View className="flex-1 justify-center gap-y-1 bg-gray-100 px-5 py-7 rounded-lg">
              <Text className="text-2xl font-semibold">{home.overview.occupancyRate}%</Text>
              <Text>Occupied</Text>
              <Text className="text-gray-500 text-[0.9rem]">From venue&apos;s full capacity.</Text>
            </View>
            <View className="flex-1 justify-center gap-y-1 bg-gray-100 px-5 py-7 rounded-lg">
              <Text className="text-2xl font-semibold">EGP {Math.max(0, home.overview.profit).toFixed(2)}</Text>
              <Text>in profit today.</Text>
            </View>
          </View>
        </View>
        <View className="gap-y-4">
          <View className="px-6 flex-row items-center justify-between mb-4">
            <Text className="font-medium text-[1.1rem]">Bookings</Text>
            <Link asChild href="/(dashboard)/(tabs)/bookings">
              <Pressable className="flex-row items-center gap-x-1.5">
                <Text className="text-primary">View All</Text>
                <IconChevronRight width={16} height={16} color="#1C04EA" /> 
              </Pressable> 
            </Link>
          </View>
          <View className="gap-y-4 mb-4">
            <Text className="font-medium px-6">Upcoming</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerClassName="flex-row items-center gap-x-4 px-6"
            >
              {
                home.upcoming.length > 0 ?
                  home.upcoming.map((booking) => (
                    <HomeCard key={booking.id} {...booking} />
                  )) :
                  <Text className="text-gray-500 text-[0.9rem]">No upcoming bookings yet.</Text>
              }
            </ScrollView>
          </View>
          <View className="gap-y-4">
            <Text className="font-medium px-6">Pending</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerClassName="flex-row items-center gap-x-4 px-6"
            >
              {
                home.pending.length > 0 ?
                  home.pending.map((booking) => (
                    <HomeCard key={booking.id} {...booking} />
                  )) :
                  <Text className="text-gray-500 text-[0.9rem]">No pending bookings yet.</Text>
              } 
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
