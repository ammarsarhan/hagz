import { client } from '@/lib/client';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home() {
  const { data, error, isPending, isError } = useQuery({
    queryKey: ['pitches', 'feed'],
    queryFn: async () => {
      const res = await client.app.pitches.feed.$get();
      const { data } = await res.json();
      return data;
    },
  });

  if (isPending) {
    return null;
  }

  if (isError) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1">

    </SafeAreaView>
  );
}