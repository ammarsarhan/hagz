import { ScrollView, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { client } from '@/lib/client';
import FeedSection, { FeedSectionSkeleton } from '@/components/feed/FeedSection';
import { parseCamelCase } from '@/lib/string';

export default function Home() {
  const { data, error, isPending, isError } = useQuery({
    queryKey: ['pitches', 'feed'],
    queryFn: async () => {
      const res = await client.app.pitches.feed.$get();
      const { data } = await res.json();
      return data;
    },
  });

  const skeletons = [1, 2, 3, 4];

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 gap-y-6 pt-6 px-6">
        <Text className="text-4xl font-semibold">Home</Text>
        <ScrollView contentContainerStyle={{ gap: 24 }} showsVerticalScrollIndicator={false}>
          {
            skeletons.map((_, index) => <FeedSectionSkeleton key={index}/>)
          }
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isError) {
    return null;
  }

  const sections = [...Object.entries(data.personalized), ...Object.entries(data.general)]
    .filter(([, items]) => items.length > 0)
    .map(([key, items]) => ({
      label: parseCamelCase(key),
      data: items,
    }));

  return (
      <SafeAreaView className="flex-1 gap-y-6 pt-6 px-6">
        <Text className="text-4xl font-semibold">Home</Text>
        <ScrollView contentContainerStyle={{ gap: 24 }} showsVerticalScrollIndicator={false}>
          {
            sections.map((section, index) => {
              return <FeedSection label={section.label} cards={section.data} key={index}/>
            })
          }
        </ScrollView>
      </SafeAreaView>
  );
}
