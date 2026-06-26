import { ScrollView, View } from 'react-native';
import FeedHeader, { FeedHeaderSkeleton } from '@/components/feed/FeedHeader';
import { FeedCardSkeleton } from '@/components/feed/FeedCard';

export function FeedSectionSkeleton() {
    const skeletons = [1, 2, 3, 4, 5];

    return (
        <View className="gap-y-4">
            <FeedHeaderSkeleton />
            <ScrollView
                horizontal
                contentContainerStyle={{ gap: 32 }}
                showsHorizontalScrollIndicator={false}
            >
                {skeletons.map((_, index) => <FeedCardSkeleton key={index}/>)}
            </ScrollView>
        </View>
    );
};

export default function FeedSection({ label, cards } : { label: string, cards: Array<any> }) {
    return (
        <View className="gap-y-4">
            <FeedHeader label={label} />
            <ScrollView
                horizontal
                contentContainerStyle={{ gap: 32 }}
                showsHorizontalScrollIndicator={false}
            >
                {
                    
                }
            </ScrollView>
        </View>
    )
}
