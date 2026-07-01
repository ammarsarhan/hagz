import { ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { client } from '@/lib/client';
import FeedSection, { FeedSectionSkeleton } from '@/components/user/feed/FeedSection';
import { parsePitchFeedResponse } from '@/lib/types/pitch';

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
      <SafeAreaView className="flex-1 gap-y-6" edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {skeletons.map((_, index) => {
            return <FeedSectionSkeleton key={index} />;
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isError) {
    return null;
  }

  const sections = parsePitchFeedResponse(data);

  return (
    <SafeAreaView className="flex-1 gap-y-6" edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {sections.map((section, index) => {
          return (
            <FeedSection
              label={section.label}
              description={section.description}
              cards={section.cards}
              key={index}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
