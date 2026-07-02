import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '@/components/shared/Avatar';

import Button from '@/components/shared/Button';
import { useAuth } from '@/context/AuthContext';

import Icon from '@/assets/logos/logo-cropped.svg';
import Logo from '@/components/dashboard/Logo';

export default function Index() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#FFFFFF', '#D7FF0C']}
        start={{ x: 0.5, y: 0.25 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1, opacity: 0.15, position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className='flex-1 gap-y-8 p-6'>
        <View className='flex-row items-center justify-between'>
          <Logo />
          <Avatar /> 
        </View>
        <View className='flex-1 items-center justify-center opacity-5'>
          <Icon 
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          />
        </View>
        <View className='gap-y-8 w-full'>
          <View className='gap-y-3 items-center justify-center'>
            <Text className='text-4xl font-semibold text-left'>{t('dashboard.onboarding.owner.index.title', { name: user?.firstName })}</Text>
            <Text className='text-gray-500 text-left w-full mb-6'>{t('dashboard.onboarding.owner.index.description')}</Text>
            <Button className='bg-primary border-primary w-full'>
              <Text className='font-semibold'>{t('dashboard.onboarding.owner.index.cta')}</Text>
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
