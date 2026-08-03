import Avatar from "@/components/shared/Avatar";
import { usePitch } from "@/context/PitchContext";
import { IconBell, IconChevronRight, IconQrcode } from "@tabler/icons-react-native";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LineGraph } from "react-native-graph";
import HomeCard from "@/components/tabs/HomeCard";
import { formatDate } from "date-fns";

const data = [
  { date: new Date("2026-08-01T08:00:00"), value: 12 },
  { date: new Date("2026-08-01T10:00:00"), value: 18 },
  { date: new Date("2026-08-01T12:00:00"), value: 15 },
  { date: new Date("2026-08-01T14:00:00"), value: 27 },
  { date: new Date("2026-08-01T16:00:00"), value: 34 },
  { date: new Date("2026-08-01T18:00:00"), value: 30 },
  { date: new Date("2026-08-01T20:00:00"), value: 48 },
];

export default function Index() {
  const { pitch, isLoading } = usePitch();
  if (isLoading) return null;

  return (
    <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-y-10 pb-10"
        showsVerticalScrollIndicator={false}
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
            <Text className="text-4xl font-semibold">{pitch.name}</Text>
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
                  <Text className="text-6xl font-semibold mb-0.5">48h</Text>
                  <Text className="mb-0.5">Booked</Text>
                  <Text>Venue-wide</Text>
                </View>
              </View>
              <View className="flex-1">
                <LineGraph
                  points={data}
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
            <View className="flex-row gap-x-6">
              <View className="flex-1 justify-center gap-y-1 bg-gray-100 p-5 rounded-lg">
                <Text className="text-2xl font-semibold">87%</Text>
                <Text>Occupied</Text>
                <Text className="text-gray-500 text-xs">From venue&apos;s full capacity.</Text>
              </View>
              <View className="flex-1 justify-center gap-y-1 bg-gray-100 p-5 rounded-lg">
                <Text className="text-2xl font-semibold">EGP 32,000.00</Text>
                <Text>in profit today.</Text>
              </View>
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
              <HomeCard />
              <HomeCard />
              <HomeCard />
              <HomeCard />
              <HomeCard />
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
              <HomeCard />
              <HomeCard />
              <HomeCard />
              <HomeCard />
              <HomeCard />
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
