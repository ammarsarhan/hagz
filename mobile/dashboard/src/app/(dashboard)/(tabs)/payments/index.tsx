import LedgerRow, { LedgerRowSkeleton } from "@/components/tabs/LedgerRow";
import PayoutRow, { PayoutRowSkeleton } from "@/components/tabs/PayoutRow";
import { usePitch } from "@/context/PitchContext";
import cn from "@/lib/cn";
import { useInfiniteLedgerEntries, useInfinitePayouts } from "@/lib/hooks/payments";
import { formatCurrency } from "@/lib/string";
import { IconAdjustmentsHorizontal, IconArrowsTransferUpDown, IconPlus, IconReceipt, IconSettings } from "@tabler/icons-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, LayoutChangeEvent, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Extrapolation, interpolate, interpolateColor, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Link } from "expo-router";

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function Index() {
  const [view, setView] = useState<"entries" | "payouts">("entries");
  const insets = useSafeAreaInsets();
  const { pitch, isLoading: isPitchLoading } = usePitch();

  const pitchId = pitch?.id ?? "";

  const isEntriesView = view === "entries";
  const isPayoutsView = view === "payouts";

  const listOpacity = useSharedValue(1);
  const pendingView = useRef<"entries" | "payouts" | null>(null);

  const scrollY = useSharedValue(0);
  const [mainHeaderHeight, setMainHeaderHeight] = useState(260);

  const handleScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const handleMainHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setMainHeaderHeight(h);
  }, []);

  const tabSwitcherBorderStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [mainHeaderHeight - 15, mainHeaderHeight],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      borderBottomColor: interpolateColor(
        progress,
        [0, 1],
        ["transparent", "#F3F4F6"]
      ),
      borderBottomWidth: 1,
    };
  });

  const handleViewSwitch = useCallback((nextView: "entries" | "payouts") => {
    if (nextView === view) return;
    pendingView.current = nextView;

    listOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        runOnJS(setView)(nextView);
      }
    });
  }, [view, listOpacity]);

  useEffect(() => {
    if (pendingView.current === view) {
      pendingView.current = null;
      const raf = requestAnimationFrame(() => {
        listOpacity.value = withTiming(1, { duration: 150 });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [view, listOpacity]);

  const listStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  const {
    data: entriesData,
    isLoading: isEntriesLoading,
    isFetchingNextPage: isFetchingNextEntries,
    hasNextPage: hasNextEntries,
    fetchNextPage: fetchNextEntries,
    isRefetching: isEntriesRefetching,
    refetch: refetchEntries,
  } = useInfiniteLedgerEntries(pitchId, { limit: 10 }, isEntriesView && !!pitchId);

  const {
    data: payoutsData,
    isLoading: isPayoutsLoading,
    isFetchingNextPage: isFetchingNextPayouts,
    hasNextPage: hasNextPayouts,
    fetchNextPage: fetchNextPayouts,
    isRefetching: isPayoutsRefetching,
    refetch: refetchPayouts,
  } = useInfinitePayouts(pitchId, { limit: 10 }, isPayoutsView && !!pitchId);

  const rawEntries = useMemo(
    () => entriesData?.pages.flatMap((page) => page.entries) ?? [],
    [entriesData]
  );

  const rawPayouts = useMemo(
    () => payoutsData?.pages.flatMap((page) => page.payouts) ?? [],
    [payoutsData]
  );

  const entries = useMemo(
    () => [{ id: "tabSwitcher", isHeader: true } as any, ...rawEntries],
    [rawEntries]
  );

  const payouts = useMemo(
    () => [{ id: "tabSwitcher", isHeader: true } as any, ...rawPayouts],
    [rawPayouts]
  );

  const isRefreshing = isEntriesView
    ? (isEntriesRefetching && !isFetchingNextEntries)
    : (isPayoutsRefetching && !isFetchingNextPayouts);

  const handleRefresh = useCallback(() => {
    if (isEntriesView) {
      refetchEntries();
    } else {
      refetchPayouts();
    }
  }, [isEntriesView, refetchEntries, refetchPayouts]);

  const handleEndReached = useCallback(() => {
    if (isEntriesView) {
      if (hasNextEntries && !isFetchingNextEntries && !isEntriesLoading) {
        fetchNextEntries();
      }
    } else {
      if (hasNextPayouts && !isFetchingNextPayouts && !isPayoutsLoading) {
        fetchNextPayouts();
      }
    }
  }, [
    isEntriesView,
    hasNextEntries,
    isFetchingNextEntries,
    isEntriesLoading,
    fetchNextEntries,
    hasNextPayouts,
    isFetchingNextPayouts,
    isPayoutsLoading,
    fetchNextPayouts,
  ]);

  if (isPitchLoading || !pitch) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white" edges={["top"]}>
        <ActivityIndicator size="large" color="#000000" />
      </SafeAreaView>
    );
  }

  const firstEntryPage = entriesData?.pages[0];
  const firstPayoutPage = payoutsData?.pages[0];
  const balance = firstEntryPage?.balance ?? firstPayoutPage?.balance ?? 0;
  const formattedBalance = formatCurrency(balance, { signDisplay: "always" });

  const renderHeader = () => (
    <View onLayout={handleMainHeaderLayout} className="gap-y-6 pb-4 px-6" style={{ paddingTop: insets.top / 1.5 }}>
      <View className="flex-row items-center justify-between">
        <View className="gap-y-1">
          <Text className="text-4xl font-semibold">Payments</Text>
          <Text className="text-gray-500">As of {new Date().toLocaleDateString("en-GB")}</Text>
        </View>
        <Pressable className="size-11 rounded-full bg-gray-100 items-center justify-center">
          <IconSettings width={18} height={18} color="#000000" strokeWidth={2.25} />
        </Pressable>
      </View>
      <View className="py-6 items-center justify-center gap-y-2">
        <Text className="text-4xl font-semibold">{formattedBalance}</Text>
        <Text className="text-gray-500">Current Ledger Balance</Text>
      </View>
      <View className="flex-row items-center justify-center gap-x-8">
        <Link asChild href="/(dashboard)/(tabs)/payments/record"> 
          <Pressable className="gap-y-3 items-center">
            <View className="rounded-lg bg-gray-100 items-center justify-center size-16">
              <IconPlus width={20} height={20} strokeWidth={2.25} />
            </View>
            <Text className="font-medium text-[0.925rem]">Record</Text>
          </Pressable>
        </Link>
        <Pressable className="gap-y-3 items-center">
          <View className="rounded-lg bg-primary items-center justify-center size-16">
            <IconArrowsTransferUpDown width={20} height={20} strokeWidth={2.25} color="#FFFFFF" />
          </View>
          <Text className="font-medium text-[0.925rem]">Payout</Text>
        </Pressable>
        <Pressable className="gap-y-3 items-center">
          <View className="rounded-lg bg-gray-100 items-center justify-center size-16">
            <IconReceipt width={22} height={22} strokeWidth={2.25} />
          </View>
          <Text className="font-medium text-[0.925rem]">Export</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderTabSwitcher = () => (
    <Animated.View style={tabSwitcherBorderStyle} className="bg-white flex-row items-center justify-between py-4 px-6">
      <View className="flex-row items-center gap-x-6">
        <Pressable className="items-center gap-y-2" onPress={() => handleViewSwitch("entries")}>
          <Text className={cn("font-medium text-[1.05rem]", isEntriesView ? "text-black" : "text-gray-500")}>
            Entries
          </Text>
          <View className={cn("h-[3px] rounded-full w-1/2", isEntriesView ? "bg-primary" : "bg-transparent")} />
        </Pressable>
        <Pressable className="items-center gap-y-2" onPress={() => handleViewSwitch("payouts")}>
          <Text className={cn("font-medium text-[1.05rem]", isPayoutsView ? "text-black" : "text-gray-500")}>
            Payouts
          </Text>
          <View className={cn("h-[3px] rounded-full w-1/2", isPayoutsView ? "bg-primary" : "bg-transparent")} />
        </Pressable>
      </View>
      <Pressable className="size-11 rounded-full bg-gray-100 items-center justify-center">
        <IconAdjustmentsHorizontal width={18} height={18} strokeWidth={2.25} />
      </Pressable>
    </Animated.View>
  );

  const renderItem = ({ item }: { item: any }) => {
    if (item.isHeader) {
      return renderTabSwitcher();
    }

    return (
      <Animated.View style={listStyle}>
        {isEntriesView ? <LedgerRow entry={item} /> : <PayoutRow payout={item} />}
      </Animated.View>
    );
  };

  const renderEmpty = () => {
    const isLoading = isEntriesView ? isEntriesLoading : isPayoutsLoading;

    if (isLoading) {
      return (
        <Animated.View style={listStyle} className="gap-y-1">
          {
            isEntriesView ? 
              Array(4).map((_, index) => <LedgerRowSkeleton key={index}/>) : 
              Array(4).map((_, index) => <PayoutRowSkeleton key={index}/>)
          }
        </Animated.View>
      );
    }

    return (
      <Animated.View style={listStyle} className="py-8 items-center justify-center">
        <Text className="text-gray-500">
          {isEntriesView ? "No ledger entries found." : "No payouts found."}
        </Text>
      </Animated.View>
    );
  };

  const renderFooter = () => {
    const isFetchingNext = isEntriesView ? isFetchingNextEntries : isFetchingNextPayouts;
    if (!isFetchingNext) return null;

    return (
      <Animated.View style={listStyle} className="py-4">
        {
          isEntriesView ?
            <>
              <LedgerRowSkeleton />
              <LedgerRowSkeleton />
            </>
          :
            <>
              <PayoutRowSkeleton />
              <PayoutRowSkeleton />
            </>
        }
      </Animated.View>
    );
  };

  return (
    <SafeAreaView className="flex-1" edges={["top"]}>
      {isEntriesView ? (
        <AnimatedFlatList
          className="flex-1"
          data={entries}
          keyExtractor={(item: any) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          stickyHeaderIndices={[1]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.15}
          contentContainerClassName="pb-10"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      ) : (
        <AnimatedFlatList
          className="flex-1"
          data={payouts}
          keyExtractor={(item: any) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          stickyHeaderIndices={[1]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.15}
          contentContainerClassName="pb-10"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
