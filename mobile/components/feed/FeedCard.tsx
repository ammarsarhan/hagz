import formatCurrency from '@/lib/currency';
import { FeedPitch } from '@/lib/types/pitch';
import { useEffect } from 'react';
import { View, Text } from 'react-native';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function FeedCardSkeleton() {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
    }, [opacity]);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return <Animated.View style={style} className="h-40 w-64 rounded-lg bg-gray-200" />;
}

export default function FeedCard({ pitch } : { pitch: FeedPitch }) {
  return (
    <View className='gap-y-3 w-60'>
      <View className='h-60 w-full bg-gray-200 rounded-lg'>
      </View>
      <View className='gap-y-1'>
        <Text className='text-xl font-medium'>{pitch.name}</Text>
        <Text className='text-gray-500'></Text>
      </View>
    </View>
  );
}
