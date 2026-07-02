import { View, Text } from "react-native";
import Icon from '@/assets/logos/logo-cropped.svg';
import { useTranslation } from "react-i18next";

export default function Logo() {
    const { t } = useTranslation();

    return (
        <View className='flex-row items-center gap-x-2.5'>
            <View className="size-12 items-center justify-center rounded-md bg-primary">
                <Icon width={20} height={20} color={'#1F4F33'} />
            </View>
            <View>
                <Text className='font-semibold text-sm text-gray-500 -mb-1'>{t('components.dashboard.logo.first')}</Text>
                <Text className='font-semibold text-sm text-gray-500'>{t('components.dashboard.logo.second')}</Text>
            </View>
        </View>
    )
}