import { useEffect } from 'react';
import { View, Text } from 'react-native';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function FeedHeaderSkeleton() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View className="gap-y-3 px-6">
      <Animated.View style={style} className="h-6 w-1/3 rounded-lg bg-gray-200" />
      <Animated.View style={style} className="h-6 w-2/3 rounded-lg bg-gray-200" />
    </View>
  );
}

export default function FeedHeader({
  label,
  description,
}: {
  label: string;
  description: string | null;
}) {
  return (
    <View className="gap-y-0.5 px-6">
      <Text className="text-left text-2xl font-semibold">{label}</Text>
      {description && <Text className="text-left text-gray-500">{description}</Text>}
    </View>
  );
}
