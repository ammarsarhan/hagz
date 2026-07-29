import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, subDays, formatDate, eachDayOfInterval, isSameDay } from 'date-fns';
import { IconChevronRight, IconLayoutDashboard } from "@tabler/icons-react-native";
import { usePitch } from "@/context/PitchContext";
import { sportMap } from "@/lib/types/ground";
import cn from "@/lib/cn";

export default function Bookings() {
  const { pitch, isLoading } = usePitch();
  
  const [selectedGround, setSelectedGround] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateScrollRef = useRef<ScrollView>(null);
  const itemPositions = useRef<{ [key: string]: number }>({});
  const layoutCount = useRef(0);

  useEffect(() => {
    if (!isLoading) {
      if (pitch.grounds.length > 1) {
        setSelectedGround('all');
      } else {
        setSelectedGround(pitch.grounds[0].id);
      }
    };
  }, [isLoading, pitch?.grounds])

  if (isLoading) return null;

  const hasAll = pitch.grounds.length > 1;

  const upperBoundary = addDays(new Date(), 14);
  const lowerBoundary = subDays(new Date(), 7);
  const dateRange = eachDayOfInterval({
    start: lowerBoundary,
    end: upperBoundary,
  });

  const handleDateLayout = (key: string, x: number) => {
    itemPositions.current[key] = x;
    layoutCount.current += 1;

    if (layoutCount.current === dateRange.length) {
      const key = dateRange.find((date) => isSameDay(date, new Date()))?.toISOString();

      if (key && itemPositions.current[key] !== undefined) {
        const offset = Math.max(itemPositions.current[key] - 24, 0);
        dateScrollRef.current?.scrollTo({ x: offset, animated: false });
      }
    }
  };
  
  return (
    <SafeAreaView className="flex-1 py-10 gap-y-6">
      <View className="gap-y-1 px-6">
        <Text className="text-4xl font-semibold">Bookings</Text>
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerClassName="flex-row items-center gap-x-3 px-6"
        >
          {
            hasAll &&
            <Pressable
              className="flex-row items-center gap-x-1.5 border border-primary rounded-full px-4 py-2"
            >
              <IconLayoutDashboard color="#1C04EA" size={16} />
              <Text className="text-primary text-sm font-medium">
                All
              </Text>
            </Pressable>
          }
          {
            pitch.grounds.map((ground) => {
              const isActive = ground.id === selectedGround;
              const SportIcon = sportMap[ground.sport].icon;

              return (
                <Pressable
                  key={ground.id}
                  className={cn(`flex-row items-center gap-x-1.5 border rounded-full px-4 py-2`, isActive ? "border-primary bg-white" : "border-gray-300 bg-white")}
                >
                  <SportIcon color={isActive ? "#1C04EA" : "#9CA3AF"} size={16} />
                  <Text className={cn("text-sm font-medium", isActive ? "text-primary" : "text-gray-400")}>
                    {ground.name}
                  </Text>
                </Pressable>
              );
            })
          }
        </ScrollView>
      </View>
      <View className="flex-row items-center justify-between px-6 py-2">
        <Text>{formatDate(selectedDate, "dd MMM")}</Text>
        <Pressable className="flex-row items-center gap-x-1">
          <Text className="text-primary">Select date</Text>
          <IconChevronRight size={14} color="#1C04EA"/>
        </Pressable>
      </View>
      <View>
        <ScrollView
          ref={dateScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerClassName="flex-row items-center gap-x-8 px-6"
        >
          {
            dateRange.map((date) => {
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              const key = date.toISOString();

              return (
                <Pressable
                  key={key}
                  className="gap-y-4 items-center"
                  onPress={() => setSelectedDate(date)}
                  onLayout={(e) => handleDateLayout(key, e.nativeEvent.layout.x)}
                >
                  <Text className={cn("text-sm", isSelected ? "text-black font-medium" : "text-gray-500")}>
                    {formatDate(date, "EEEEE")}
                  </Text>
                  <View className={cn("rounded-full items-center justify-center size-10", isSelected ? "bg-primary" : isToday ? "bg-gray-100" : "")}>
                    <Text className={cn("font-medium", isSelected ? "text-white text-sm" : "text-black")}>
                      {formatDate(date, "d")}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          }
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}