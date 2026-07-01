import { ScrollView, View } from 'react-native';
import FeedHeader, { FeedHeaderSkeleton } from '@/components/user/feed/FeedHeader';
import { FeedCardSkeleton, FeedLargeCard, FeedStandardCard } from '@/components/user/feed/FeedCard';
import { FeedPitch } from '@/lib/types/pitch';

export function FeedSectionSkeleton({ isVertical = false }: { isVertical?: boolean }) {
    const skeletons = [1, 2, 3];

    return (
        <View className="gap-y-6 py-6">
            <FeedHeaderSkeleton />
            <ScrollView
                horizontal={!isVertical}
                contentContainerStyle={{ gap: 32, paddingLeft: 24, paddingRight: 24 }}
                showsHorizontalScrollIndicator={false}
            >
                {
                    skeletons.map((_, index) => (
                        <FeedCardSkeleton 
                            key={index} 
                            variant={isVertical ? 'large' : 'standard'} 
                        />
                    ))
                }
            </ScrollView>
        </View>
    );
};

export default function FeedSection({ label, description, cards } : { label: string, description: string | null, cards: FeedPitch[] }) {
    const isVertical = cards.length <= 3;

    return (
        <View className="gap-y-6 py-6">
            <FeedHeader label={label} description={description}/>
            <ScrollView
                horizontal={!isVertical}
                contentContainerStyle={{ gap: 32, paddingLeft: 24, paddingRight: 24 }}
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
