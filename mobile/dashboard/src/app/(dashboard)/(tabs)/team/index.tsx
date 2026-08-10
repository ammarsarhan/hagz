import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Input from "@/components/shared/Input";
import StaffCard, { StaffCardSkeleton } from "@/components/tabs/StaffCard";
import InvitationCard, { InvitationCardSkeleton } from "@/components/tabs/InvitationCard";
import { IconSortAscending2, IconSortDescending2, IconUserPlus } from "@tabler/icons-react-native";
import { Link } from "expo-router";
import { usePitch } from "@/context/PitchContext";
import { useAuth } from "@/context/AuthContext";
import { usePitchStaff, usePitchInvitations } from "@/lib/hooks/team";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Index() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const listOpacity = useSharedValue(1);
  const iconOpacity = useSharedValue(1);
  const sortPressed = useSharedValue(0);
  const pendingSort = useRef<"asc" | "desc" | null>(null);

  const { pitch, isLoading: isPitchLoading } = usePitch();
  const { user } = useAuth();
  const pitchId = pitch?.id ?? "";

  const {
    data: staff,
    isLoading: isStaffLoading,
  } = usePitchStaff(pitchId, !!pitchId);

  const {
    data: invitations,
    isLoading: isInvitationsLoading,
  } = usePitchInvitations(pitchId, !!pitchId);

  const handleScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const handleToggleSort = useCallback(() => {
    const nextSort = sortOrder === "asc" ? "desc" : "asc";
    pendingSort.current = nextSort;

    iconOpacity.value = withTiming(0, {
      duration: 100,
      easing: Easing.inOut(Easing.ease),
    });

    listOpacity.value = withTiming(
      0,
      {
        duration: 120,
        easing: Easing.inOut(Easing.ease),
      },
      (finished) => {
        if (finished) {
          runOnJS(setSortOrder)(nextSort);
        }
      }
    );
  }, [sortOrder, listOpacity, iconOpacity]);

  const handleSortPressIn = useCallback(() => {
    sortPressed.value = withTiming(1, {
      duration: 100,
      easing: Easing.inOut(Easing.ease),
    });
  }, [sortPressed]);

  const handleSortPressOut = useCallback(() => {
    sortPressed.value = withTiming(0, {
      duration: 150,
      easing: Easing.inOut(Easing.ease),
    });
  }, [sortPressed]);

  useEffect(() => {
    if (pendingSort.current === sortOrder) {
      pendingSort.current = null;
      const raf = requestAnimationFrame(() => {
        iconOpacity.value = withTiming(1, {
          duration: 120,
          easing: Easing.inOut(Easing.ease),
        });
        listOpacity.value = withTiming(1, {
          duration: 150,
          easing: Easing.inOut(Easing.ease),
        });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [sortOrder, listOpacity, iconOpacity]);

  const animatedListStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
  }));

  const animatedSortButtonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      sortPressed.value,
      [0, 1],
      ["#F3F4F6", "#E5E7EB"]
    ),
  }));

  const sortedAndFilteredInvitations = useMemo(() => {
    if (!invitations) return [];
    let result = [...invitations];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (inv) =>
          inv.name.toLowerCase().includes(q) ||
          inv.phone.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [invitations, searchQuery, sortOrder]);

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

  if (isPitchLoading || !pitch) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white" edges={["top"]}>
        <ActivityIndicator size="large" color="#000000" />
      </SafeAreaView>
    );
  }

  const SortIcon = sortOrder === "asc" ? IconSortAscending2 : IconSortDescending2;

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
          showsHorizontalScrollIndicator={false}
        >
          {isStaffLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <StaffCardSkeleton key={index} />
            ))
          ) : staff && staff.length > 0 ? (
            staff.map((member) => (
              <StaffCard
                key={member.userId}
                member={member}
                isCurrent={member.userId === user?.id}
              />
            ))
          ) : (
            <View className="py-2">
              <Text className="text-gray-500">No staff members found.</Text>
            </View>
          )}
        </ScrollView>

        <View className="px-6 my-2 gap-y-4">
          <Text className="text-gray-500 text-sm">
            You may add up to 10 staff members per venue & have up to 3 pending invitations at most.
          </Text>
          <View className="flex-row items-center gap-x-4">
            <View className="flex-1">
              <Input
                placeholder="Search invitations..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <View className="flex-row items-center gap-x-3">
              <AnimatedPressable
                onPress={handleToggleSort}
                onPressIn={handleSortPressIn}
                onPressOut={handleSortPressOut}
                accessibilityRole="button"
                accessibilityLabel={`Sorted ${sortOrder === "asc" ? "Oldest first" : "Newest first"}`}
                style={animatedSortButtonStyle}
                className="rounded-full size-11 items-center justify-center"
              >
                <Animated.View style={animatedIconStyle}>
                  <SortIcon width={18} height={18} strokeWidth={2.25} color="#111827" />
                </Animated.View>
              </AnimatedPressable>
            </View>
          </View>
        </View>

        <Animated.View style={animatedListStyle} className="px-6 my-4">
          {isInvitationsLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <InvitationCardSkeleton key={index} />
            ))
          ) : sortedAndFilteredInvitations.length > 0 ? (
            sortedAndFilteredInvitations.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation} />
            ))
          ) : (
            <View className="py-8 items-center justify-center">
              <Text className="text-gray-500">
                {searchQuery.trim() ? "No matching invitations found." : "No invitations found."}
              </Text>
            </View>
          )}
        </Animated.View>
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