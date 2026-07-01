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
    opacity.value = withRepeat(
        withTiming(1, { duration: 1000 }), -1, true);
    }, [opacity]);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View className='px-6 gap-y-3'>
            <Animated.View style={style} className="h-6 w-1/3 rounded-lg bg-gray-200" />
            <Animated.View style={style} className="h-6 w-2/3 rounded-lg bg-gray-200" />
        </View>
    );
}

export default function FeedHeader({ label, description } : { label: string, description: string | null }) {
    return (
        <View className='gap-y-0.5 px-6'>
            <Text className='text-2xl font-semibold text-left'>{label}</Text>
            {
                description &&
                <Text className='text-gray-500 text-left'>{description}</Text>
            }
        </View>
    );
}
