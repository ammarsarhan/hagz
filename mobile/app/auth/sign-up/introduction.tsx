import { useEffect, useRef } from 'react';
import { AppState, StatusBar, View, Text, Animated } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/shared/Button';
import Logo from '@/assets/logos/logo-cropped.svg';
import Hero from '@/assets/static/hero.mp4';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

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

  const { t } = useTranslation();

  return (
    <>
      <StatusBar barStyle="light-content" />
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
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}>
          <LinearGradient
            colors={['black', 'transparent', 'black']}
            locations={[0, 0.2, 1]}
            style={{ flex: 1 }}
          />
          <SafeAreaView className="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-end">
            <View className="gap-y-6 p-6">
              <View className="gap-y-3">
                <Logo width={50} height={50} color={'#FFFFFF'} />
                <Text className="text-left text-4xl font-semibold text-white">
                  {t('auth.signUp.introduction.title')}
                </Text>
                <Text className="text-left text-white/85">
                  {t('auth.signUp.introduction.description')}
                </Text>
              </View>
              <View className="gap-y-3">
                <Link href="/auth/sign-up/role" asChild>
                  <Button className="border-primary bg-primary">
                    <Text className="font-semibold">
                      {t('auth.signUp.introduction.cta.primary')}
                    </Text>
                  </Button>
                </Link>
                <Link href="/user/main" asChild>
                  <Button className="border-white bg-white">
                    <Text className="font-semibold">
                      {t('auth.signUp.introduction.cta.secondary')}
                    </Text>
                  </Button>
                </Link>
              </View>
              <View className="flex items-center">
                <Text className="w-3/4 text-center text-sm text-white">
                  {t('auth.signUp.introduction.disclaimer')}
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </>
  );
}
