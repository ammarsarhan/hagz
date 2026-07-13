import Animated, { FadeIn } from "react-native-reanimated";

export default function Index() {
    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 px-6 gap-y-8">

        </Animated.View>
    )
}