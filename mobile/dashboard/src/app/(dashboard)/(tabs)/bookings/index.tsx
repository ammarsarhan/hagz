import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, LayoutChangeEvent, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { addDays, addHours, subDays, formatDate, eachDayOfInterval, isSameDay } from 'date-fns';
import { IconChevronRight, IconFocusCentered, IconLayoutDashboard, IconListDetails, IconPlus } from "@tabler/icons-react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { usePitch } from "@/context/PitchContext";
import CalendarModal from "@/components/shared/CalendarModal";
import { sportMap } from "@/lib/types/ground";
import cn from "@/lib/cn";
import { useBookings } from "@/lib/hooks";
import BookingRow, { BookingCard } from "@/components/tabs/BookingRow";
import { BookingRowData, PricingSnapshot } from "@/lib/types/bookings";
import { Link } from "expo-router";

// Day button with smooth animated color transitions via Reanimated interpolateColor.
const AnimatedDayButton = memo(function AnimatedDayButton({
  date,
  isSelected,
  isToday,
  onPress,
  onLayout,
}: {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  onPress: () => void;
  onLayout?: (x: number) => void;
}) {
  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected, progress]);

  const circleBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [isToday ? "#F3F4F6" : "#FFFFFF", "#1C04EA"]
    ),
  }));

  const dayNumberStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      ["#000000", "#FFFFFF"]
    ),
  }));

  const dayLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      ["#6B7280", "#000000"]
    ),
  }));

  return (
    <Pressable
      className="gap-y-4 items-center"
      onPress={onPress}
      onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.x) : undefined}
    >
      <Animated.Text style={[dayLabelStyle, { fontSize: 13, fontWeight: isSelected ? "500" : "400" }]} className={isSelected ? "font-medium" : undefined}>
        {formatDate(date, "EEEEE")}
      </Animated.Text>
      <Animated.View
        style={circleBgStyle}
        className="rounded-full items-center justify-center size-10"
      >
        <Animated.Text style={[dayNumberStyle, { fontSize: isSelected ? 13 : 14, fontWeight: "500" }]}>
          {formatDate(date, "d")}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

export default function Bookings() {
  const { pitch, isLoading: isPitchLoading } = usePitch();

  const insets = useSafeAreaInsets();

  const [selectedGround, setSelectedGround] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingGrouped, setIsBookingGrouped] = useState(false);

  const toggleIconOpacity = useSharedValue(1);
  const listOpacity = useSharedValue(1);

  const toggleIconStyle = useAnimatedStyle(() => ({
    opacity: toggleIconOpacity.value,
  }));
  const listStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  const handleToggleGrouped = () => {
    const next = !isBookingGrouped;

    toggleIconOpacity.value = withTiming(0, { duration: 150 });
    listOpacity.value = withTiming(0, { duration: 150 }, () => {
      // Toggle grouped view state
    });
    setIsBookingGrouped(next);
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      toggleIconOpacity.value = withTiming(1, { duration: 150 });
      listOpacity.value = withTiming(1, { duration: 150 });
    });

    return () => cancelAnimationFrame(raf);
  }, [isBookingGrouped, listOpacity, toggleIconOpacity]);

  // Pure JS thread date selection + smooth list opacity fade in on date change
  const handleDateSelect = useCallback((date: Date) => {
    if (isSameDay(date, selectedDate)) return;
    listOpacity.value = 0;
    setSelectedDate(date);
  }, [selectedDate, listOpacity]);

  useEffect(() => {
    listOpacity.value = withTiming(1, { duration: 200 });
  }, [selectedDate, listOpacity]);

  const dateScrollRef = useRef<ScrollView>(null);
  const itemPositions = useRef<Record<string, number>>({});
  const layoutCount = useRef(0);

  useEffect(() => {
    if (!isPitchLoading && pitch?.grounds) {
      if (pitch.grounds.length > 1) {
        setSelectedGround('all');
      } else if (pitch.grounds.length === 1) {
        setSelectedGround(pitch.grounds[0].id);
      }
    }
  }, [isPitchLoading, pitch?.grounds]);

  const target = selectedGround === "all" ? undefined : (selectedGround ?? undefined);

  const { data, isLoading: isBookingsLoading, refetch, isRefetching } = useBookings(
    selectedDate,
    pitch?.id ?? "",
    target,
    !isPitchLoading && !!pitch?.id && selectedGround !== null
  );

  const groupedBookings = useMemo(() => {
    if (!data) return [];

    const seen = new Set<string>();
    const result: { key: string; item: BookingRowData["bookings"][number]; from: Date; to: Date }[] = [];

    for (const slot of data.slots) {
      for (const item of slot.bookings) {
        const booking = item.booking!;
        if (seen.has(booking.id)) continue;
        seen.add(booking.id);

        const snapshot = booking.pricingSnapshot as unknown as PricingSnapshot;
        const sortedSlots = [...snapshot.slots].sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        );
        const from = new Date(sortedSlots[0].startsAt);
        const to = addHours(new Date(sortedSlots[sortedSlots.length - 1].startsAt), 1);

        result.push({ key: booking.id, item, from, to });
      }
    }

    return result.sort((a, b) => a.from.getTime() - b.from.getTime());
  }, [data]);

  if (isPitchLoading || !pitch) return null;

  const hasAll = pitch.grounds.length > 1;

  const upperBoundary = addDays(new Date(), 14);
  const lowerBoundary = subDays(new Date(), 7);
  const dateRange = eachDayOfInterval({
    start: lowerBoundary,
    end: upperBoundary,
  });

  const handleDateLayout = (key: string, x: number) => {
    itemPositions.current = { ...itemPositions.current, [key]: x };
    layoutCount.current += 1;

    if (layoutCount.current === dateRange.length) {
      const key = dateRange.find((date) => isSameDay(date, new Date()))?.toISOString();

      if (key && itemPositions.current[key] !== undefined) {
        const offset = Math.max(itemPositions.current[key] - 24, 0);
        dateScrollRef.current?.scrollTo({ x: offset, animated: false });
      }
    }
  };

  const renderBookings = () => {
    if (isBookingsLoading) {
      return (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator />
        </View>
      );
    }

    if (!data || data.slots.length === 0) {
      return (
        <View className="py-10 items-center justify-center">
          <Text className="text-gray-500">No bookings for this day</Text>
        </View>
      );
    }

    if (isBookingGrouped) {
      return (
        <>
          {
            groupedBookings.map(({ key, item, from, to }) => (
              <View key={key} className="px-6">
                <BookingCard item={item} hour={from} groupedRange={{ from, to }} />
              </View>
            ))
          }
        </>
      );
    }

    return (
      <>
        {
          data.slots.map((slot) => (
            <BookingRow key={slot.hour} hour={slot.hour} bookings={slot.bookings} />
          ))
        }
      </>
    );
  };

  return (
    <>
      <CalendarModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={selectedDate}
        setDate={setSelectedDate}
        pitch={pitch.id}
        target={selectedGround!}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerClassName={"gap-y-6 pb-10"}
          contentContainerStyle={{ paddingTop: insets.top / 1.5 }}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#6B728055"
              colors={["#6B728055"]}
            />
          }
        >
          {/* Child 0: Main title and grounds filter */}
          <View className="gap-y-6">
            <View className="px-6 flex-row items-center justify-between">
              <Text className="text-4xl font-semibold">Bookings</Text>
              <Pressable
                className="size-11 bg-gray-100 rounded-full items-center justify-center"
                onPress={handleToggleGrouped}
              >
                <Animated.View style={toggleIconStyle}>
                  {
                    isBookingGrouped ?
                    <IconListDetails width={16} height={16} strokeWidth={2.5} /> :
                    <IconFocusCentered width={16} height={16} strokeWidth={2.5} />
                  }
                </Animated.View>
              </Pressable>
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
                    className={cn(`flex-row items-center gap-x-1.5 border rounded-full px-4 py-2`, selectedGround === "all" ? "border-primary bg-white" : "border-gray-300 bg-white")}
                    onPress={() => setSelectedGround("all")}
                  >
                    <IconLayoutDashboard color={selectedGround === "all" ? "#1C04EA" : "#9CA3AF"} size={16} />
                    <Text className={cn("text-sm font-medium", selectedGround === "all" ? "text-primary" : "text-gray-400")}>
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
                        onPress={() => setSelectedGround(ground.id)}
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
          </View>

          {/* Child 1: Sticky Date Header & Quick Date Strip */}
          <View className="bg-white pt-2 pb-5 gap-y-5">
            <View className="flex-row items-center justify-between px-6">
              <Text className="font-medium text-lg text-black">
                {formatDate(selectedDate, "dd MMM")}
              </Text>
              <Pressable className="flex-row items-center gap-x-1" onPress={() => setIsModalOpen(true)}>
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
                      <AnimatedDayButton
                        key={key}
                        date={date}
                        isSelected={isSelected}
                        isToday={isToday}
                        onPress={() => handleDateSelect(date)}
                        onLayout={(x) => handleDateLayout(key, x)}
                      />
                    );
                  })
                }
              </ScrollView>
            </View>
          </View>

          {/* Child 2: Booking slots list with opacity transition on date switch */}
          <Animated.View style={listStyle} className="gap-y-8">
            {renderBookings()}
          </Animated.View>
        </ScrollView>
        <View className="absolute bottom-6 right-6">
          <Link href="/(dashboard)/(tabs)/bookings/modal" asChild>
            <Pressable className="rounded-full size-14 items-center justify-center bg-primary shadow-sm">
              <IconPlus width={24} height={24} color="#FFFFFF" /> 
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
};
