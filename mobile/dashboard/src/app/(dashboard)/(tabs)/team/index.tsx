import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import Input from "@/components/shared/Input";
import StaffCard, { StaffCardSkeleton } from "@/components/tabs/StaffCard";
import InvitationCard, { InvitationCardSkeleton } from "@/components/tabs/InvitationCard";
import { IconArrowsUpDown, IconUserPlus } from "@tabler/icons-react-native";
import { Link } from "expo-router";
import { usePitch } from "@/context/PitchContext";
import { useAuth } from "@/context/AuthContext";
import { usePitchStaff, usePitchInvitations } from "@/lib/hooks/team";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function Index() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [searchQuery, setSearchQuery] = useState("");

  const { pitch, isLoading: isPitchLoading } = usePitch();
  const { user } = useAuth();
  const pitchId = pitch?.id ?? "";

  const {
    data: staff,
    isLoading: isStaffLoading,
    isRefetching: isStaffRefetching,
    refetch: refetchStaff,
  } = usePitchStaff(pitchId, !!pitchId);

  const {
    data: invitations,
    isLoading: isInvitationsLoading,
    isRefetching: isInvitationsRefetching,
    refetch: refetchInvitations,
  } = usePitchInvitations(pitchId, !!pitchId);

  const handleScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const isRefreshing = (isStaffRefetching || isInvitationsRefetching) && !isStaffLoading && !isInvitationsLoading;

  const handleRefresh = useCallback(() => {
    refetchStaff();
    refetchInvitations();
  }, [refetchStaff, refetchInvitations]);

  const filteredInvitations = useMemo(() => {
    if (!invitations) return [];

    const q = searchQuery.trim().toLowerCase();
    if (!q) return invitations;
    
    return invitations.filter(
      (inv) =>
        inv.name.toLowerCase().includes(q) ||
        inv.phone.toLowerCase().includes(q)
    );
  }, [invitations, searchQuery]);

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

  return (
    <SafeAreaView className="flex-1" edges={["top"]}>
      <AnimatedScrollView
        className="flex-1"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {renderHeader()}
        <ScrollView
          horizontal
          contentContainerClassName="my-3 px-6 gap-x-6"
          showsHorizontalScrollIndicator={false}
        >
          {
            isStaffLoading ?
              Array.from({ length: 5 }).map((_, index) => (
                <StaffCardSkeleton key={index} />
              )) : 
              staff && staff.length > 0 ?
                staff.map((member) => (
                  <StaffCard
                    key={member.userId}
                    member={member}
                    isCurrentUser={member.userId === user?.id}
                  />
                )) :
                <View className="py-2">
                  <Text className="text-gray-500">No staff members found.</Text>
                </View>
          }
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
              <Pressable className="rounded-full bg-gray-100 size-11 items-center justify-center">
                <IconArrowsUpDown width={16} height={16} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        </View>
        <View className="px-6 my-4">
          {
            isInvitationsLoading ? 
              Array.from({ length: 4 }).map((_, index) => (
                <InvitationCardSkeleton key={index} />
              )) : 
              filteredInvitations.length > 0 ? 
                filteredInvitations.map((invitation) => (
                  <InvitationCard key={invitation.id} invitation={invitation} />
                )) : 
                <View className="py-8 items-center justify-center">
                  <Text className="text-gray-500">
                    {searchQuery.trim() ? "No matching invitations found." : "No invitations found."}
                  </Text>
                </View>
          }
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