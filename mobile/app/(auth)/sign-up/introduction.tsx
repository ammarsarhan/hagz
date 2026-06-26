import { useEffect, useRef } from 'react';
import { AppState, StatusBar, View, Text, Animated } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/shared/Button';
import Logo from '@/assets/logos/logo-cropped.svg';
import Hero from '@/assets/static/hero.mp4';
import { Link, router } from 'expo-router';

export default function Introduction() {
    const fade = useRef(new Animated.Value(0)).current;

    const player = useVideoPlayer(Hero, (player) => {
        player.loop = true;
        player.play();
    });

    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') player.play();
        });
        return () => sub.remove();
    }, [player]);

    const handleFirstFrame = () => {
        Animated.timing(fade, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    };

    return (
        <>
            <StatusBar barStyle='light-content' />
            <View className="flex-1 bg-white">
                <VideoView
                    player={player}
                    style={{ flex: 1 }}
                    contentFit="cover"
                    onFirstFrameRender={handleFirstFrame}
                />
                <Animated.View
                    style={{
                        opacity: fade,
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                    }}
                >
                    <LinearGradient
                        colors={['black', 'transparent', 'black']}
                        locations={[0, 0.2, 1]}
                        style={{ flex: 1 }}
                    />
                    <SafeAreaView className='flex items-center justify-end absolute top-0 bottom-0 left-0 right-0'>
                        <View className='gap-y-6 p-6'>
                            <View className='gap-y-3'>
                                <Logo width={50} height={50} color={"#FFFFFF"} />
                                <Text className='text-4xl text-white font-semibold'>Book Pitches in Seconds!</Text>
                                <Text className='text-white/85'>Find and book the perfect pitch for your next match, or list your venue and start filling slots without the hassle.</Text>
                            </View>
                            <View className='gap-y-3'>
                                <Link href="/sign-up/role" asChild>
                                    <Button className='border-primary bg-primary'>
                                        <Text className='font-semibold'>Get Started</Text>
                                    </Button>
                                </Link>
                                <Button className='border-white bg-white' onPress={() => router.back()}>
                                    <Text className='font-semibold'>Skip & Explore</Text>
                                </Button>
                            </View>
                            <View className='flex items-center'>
                                <Text className='text-white text-center text-sm w-3/4'>By continuing, you agree to the platform&apos;s Terms of Use.</Text>
                            </View>
                        </View>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </>
    );
}