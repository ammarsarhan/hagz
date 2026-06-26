import { ScrollView, View } from 'react-native';
import FeedHeader, { FeedHeaderSkeleton } from '@/components/feed/FeedHeader';
import { FeedCardSkeleton, FeedLargeCard, FeedStandardCard } from '@/components/feed/FeedCard';
import { FeedPitch } from '@/lib/types/pitch';

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
                {
                    skeletons.map((_, index) => <FeedCardSkeleton key={index}/>)
                }
            </ScrollView>
        </View>
    );
};

export default function FeedSection({ label, cards } : { label: string, cards: FeedPitch[] }) {
    const isVertical = cards.length <= 3;

    return (
        <View className={`${isVertical ? "py-4 gap-y-4" : "gap-y-4"}`}>
            <FeedHeader label={label} />
            <ScrollView
                horizontal={!isVertical}
                contentContainerStyle={{ gap: 32 }}
                showsHorizontalScrollIndicator={false}
            >
                {
                    cards.map((pitch, index) => {
                        return isVertical ? <FeedLargeCard pitch={pitch} key={index}/> : <FeedStandardCard pitch={pitch} key={index}/>;
                    })
                }
            </ScrollView>
        </View>
    )
}
