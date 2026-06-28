import formatCurrency from '@/lib/currency';
import { amenityIcons } from '@/lib/types/amenity';
import { FeedPitch } from '@/lib/types/pitch';
import { IconHeart, IconStarFilled } from '@tabler/icons-react-native';
import { View, Text } from 'react-native';
import Skeleton from '@/components/shared/Skeleton';

export function FeedCardSkeleton({ variant = 'standard' }: { variant?: 'standard' | 'large' }) {
    const isLarge = variant === 'large';
    
    return (
      <View className={`gap-y-4 ${isLarge ? 'flex-1' : 'w-[60vw]'}`}>
        <Skeleton className="aspect-square w-full"/>
        <View className='gap-y-3'>
          <Skeleton className="h-6 w-3/4"/>
          <View className='flex-row justify-between'>
            <Skeleton className="h-4 w-1/3"/>
            <Skeleton className="h-4 w-1/6"/>
          </View>
          <Skeleton className="h-4 w-full"/>
          <View className='flex-row gap-x-2'>
            <Skeleton className="h-6 w-6 rounded-full"/>
            <Skeleton className="h-6 w-6 rounded-full"/>
          </View>
        </View>
      </View>
  );
}

export function FeedLargeCard({ pitch } : { pitch: FeedPitch }) {
  const isApproximate = pitch.pricing.minimum !== pitch.pricing.maximum;

  return (
    <View className='gap-y-4 flex-1'>
      <View className='aspect-square w-full bg-gray-200 rounded-lg'>
        <View className='absolute top-4 right-4 opacity-30'>
          <IconHeart color="#000000"/>
        </View>
      </View>
      <View className='gap-y-3'>
        <Text className='font-semibold text-xl'>{pitch.name}</Text>
        <View className='flex-row items-center justify-between'>
          <Text>{isApproximate ? `${formatCurrency(pitch.pricing.minimum)}/hr` : `${formatCurrency(pitch.pricing.minimum)}/hr`}</Text>
          {
            pitch.rating.count > 0 && pitch.rating.average &&
            <View className='flex-row items-center gap-x-1.5'>
              <IconStarFilled size={14} color={'#9CA3AF'}/>
              <Text className='text-gray-500'>{pitch.rating.average.toFixed(1)}</Text>
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
        {
          pitch.badge &&
          <View className='absolute top-3 left-3 py-2 px-3 rounded-full bg-slate-100'>
            <Text className='text-sm font-medium'>{pitch.badge}</Text>
          </View>
        }
        <View className='absolute top-4 right-4 opacity-30'>
          <IconHeart color="#000000" />
        </View>
      </View>
      <View className='gap-y-3'>
        <Text className='font-semibold text-xl'>{pitch.name}</Text>
        <View className='flex-row items-center justify-between'>
          <Text>{isApproximate ? `${formatCurrency(pitch.pricing.minimum)}/hr` : `${formatCurrency(pitch.pricing.minimum)}/hr`}</Text>
          {
            pitch.rating.count > 0 && pitch.rating.average &&
            <View className='flex-row items-center gap-x-1.5'>
              <IconStarFilled size={14} color={'#9CA3AF'}/>
              <Text className='text-gray-500'>{pitch.rating.average.toFixed(1)}</Text>
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
