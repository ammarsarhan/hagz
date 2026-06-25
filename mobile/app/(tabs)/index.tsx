import { client } from '@/lib/client';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FeedResponse = Awaited<ReturnType<typeof fetchFeed>>;
type Pitch = FeedResponse['general']['featured'][number];
type NearbyPitch = FeedResponse['personalized']['nearby'][number];

async function fetchFeed() {
  const res = await client.app.pitches.feed.$get();
  const { data } = await res.json();
  return data;
}

function PitchCard({ pitch }: { pitch: Pitch | NearbyPitch }) {
  const firstImage = (pitch as any).media?.[0]?.url;

  return (
    <Pressable className="w-48 mr-3 rounded-xl overflow-hidden bg-white shadow-sm">
      <View className="w-full h-28 bg-gray-200">
        {firstImage && (
          <Image source={{ uri: firstImage }} className="w-full h-full" resizeMode="cover" />
        )}
      </View>
      <View className="p-2">
        <Text className="font-semibold text-gray-900" numberOfLines={1}>
          {pitch.name}
        </Text>
        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
          {pitch.street}
        </Text>
        {'distance' in pitch && (
          <Text className="text-xs text-blue-500 mt-0.5">
            {(pitch.distance / 1000).toFixed(1)} km away
          </Text>
        )}
        <Text className="text-xs text-green-700 font-medium mt-1">
          {pitch.minimumPrice ? `EGP ${pitch.minimumPrice}/hr` : 'Price TBD'}
        </Text>
      </View>
    </Pressable>
  );
}

function Section({ title, data }: { title: string; data: Pitch[] | NearbyPitch[] }) {
  if (!data?.length) return null;
  return (
    <View className="mb-6">
      <Text className="text-base font-bold text-gray-900 px-4 mb-3">{title}</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PitchCard pitch={item} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </View>
  );
}

export default function Home() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['pitches', 'feed'],
    queryFn: fetchFeed,
  });

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Failed to load feed.</Text>
        <Text className="text-gray-500 text-sm">{error.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-gray-900 px-4 pt-4 pb-2">Explore</Text>
        <Section title="Near You" data={data.personalized.nearby} />
        <Section title="Play Again" data={data.personalized.recentlyBooked} />
        <Section title="Featured" data={data.general.featured} />
        <Section title="Trending This Week" data={data.general.hot} />
        <Section title="Top Rated" data={data.general.rated} />
        <Section title="Budget-Friendly" data={data.general.budget} />
        <Section title="Instant Booking" data={data.general.instant} />
        <Section title="Premium" data={data.general.premium} />
      </ScrollView>
    </SafeAreaView>
  );
}