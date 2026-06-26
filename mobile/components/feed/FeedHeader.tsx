import { IconChevronRight } from '@tabler/icons-react-native';
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

    return <Animated.View style={style} className="h-8 w-1/3 rounded-lg bg-gray-200" />;
}

export default function FeedHeader({ label } : { label: string }) {
    return (
        <View className='flex-row items-center gap-x-1'>
            <Text className='text-2xl font-semibold'>{label}</Text>
        </View>
    );
}
