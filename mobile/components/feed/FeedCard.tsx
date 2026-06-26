import formatCurrency from '@/lib/currency';
import { amenityIcons } from '@/lib/types/amenity';
import { FeedPitch, PitchFeed } from '@/lib/types/pitch';
import { IconHeart, IconStarFilled } from '@tabler/icons-react-native';
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

export function FeedLargeCard({ pitch } : { pitch: FeedPitch }) {
  const isApproximate = pitch.pricing.minimum !== pitch.pricing.maximum;

  return (
    <View className='gap-y-4 flex-1'>
      <View className='aspect-square w-full bg-gray-200 rounded-lg'>
        <View className='absolute top-4 right-4 opacity-30'>
          <IconHeart color="#000000" />
        </View>
      </View>
      <View className='gap-y-3'>
        <Text className='font-semibold text-xl'>{pitch.name}</Text>
        <View className='flex-row items-center justify-between'>
          <Text>{isApproximate ? `${formatCurrency(pitch.pricing.minimum)}/hr` : `${formatCurrency(pitch.pricing.minimum)}/hr`}</Text>
          {
            pitch.rating.average &&
            <View className='flex-row items-center gap-x-1.5'>
              <IconStarFilled size={14} color={'#9CA3AF'}/>
              <Text className='text-gray-500'>{pitch.rating.average.toFixed(2)}</Text>
            </View>
          }
        </View>
        <Text className='text-gray-500'>{pitch.location.street}, {pitch.location.area.name}</Text>
        <View className='flex-row gap-x-2'>
          {
            pitch.amenities.map((amenity, index) => {
              const IconComponent = amenityIcons[amenity];
              return <IconComponent key={index} size={18} strokeWidth={2.5} color={'#000'}/>
            })
          }
        </View>
      </View>
    </View>
  );
};


export function FeedStandardCard({ pitch } : { pitch: FeedPitch }) {
  const isApproximate = pitch.pricing.minimum !== pitch.pricing.maximum;

  return (
    <View className='gap-y-4 w-[60vw]'>
      <View className='aspect-square w-full bg-gray-200 rounded-lg'>
        <View className='absolute top-4 right-4 opacity-30'>
          <IconHeart color="#000000" />
        </View>
      </View>
      <View className='gap-y-3'>
        <Text className='font-semibold text-xl'>{pitch.name}</Text>
        <View className='flex-row items-center justify-between'>
          <Text>{isApproximate ? `${formatCurrency(pitch.pricing.minimum)}/hr` : `${formatCurrency(pitch.pricing.minimum)}/hr`}</Text>
          {
            pitch.rating.average &&
            <View className='flex-row items-center gap-x-1.5'>
              <IconStarFilled size={14} color={'#9CA3AF'}/>
              <Text className='text-gray-500'>{pitch.rating.average.toFixed(2)}</Text>
            </View>
          }
        </View>
        <Text className='text-gray-500'>{pitch.location.street}, {pitch.location.area.name}</Text>
        <View className='flex-row gap-x-2'>
          {
            pitch.amenities.map((amenity, index) => {
              const IconComponent = amenityIcons[amenity];
              return <IconComponent key={index} size={18} strokeWidth={2.5} color={'#000'}/>
            })
          }
        </View>
      </View>
    </View>
  );
}
