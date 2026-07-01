import Button from '@/components/shared/Button';
import { useSignUpForm } from '@/context/forms/SignUpContext';
import { IconBallBasketball, IconSoccerField, IconUser, IconUsersPlus } from '@tabler/icons-react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Role() {
  const { data, setData } = useSignUpForm();
  const isDisabled = data.role === null;

  const { t } = useTranslation();

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 overflow-hidden bg-white">
        <View className="absolute -left-48 -top-8 -z-10 opacity-5">
          <IconBallBasketball width={400} height={400} strokeWidth={1.5} />
        </View>
        <SafeAreaView className="flex-1 items-center justify-center p-6">
          <View className="w-full gap-y-10">
            <View className="gap-y-3">
              <Text className="text-center text-4xl font-semibold">
                {t("auth.signUp.role.title")}
              </Text>
              <Text className="text-center text-gray-500">
                {t("auth.signUp.role.description")}
              </Text>
            </View>
            <View className="gap-y-6">
              <Pressable
                className={`flex-row items-center gap-x-5 rounded-xl p-5 ${data.role === 'USER' ? 'bg-[#F5FFC2]' : 'bg-gray-100'}`}
                onPress={() => setData({ ...data, role: 'USER' })}>
                <IconUser
                  height={30}
                  width={30}
                  color={data.role === 'USER' ? '#1F4F33' : '#000000'}
                />
                <View className="flex-1">
                  <Text
                    className={`text-[1.2rem] text-left font-semibold ${data.role === 'USER' ? 'text-primary-foreground' : 'text-black'}`}
                  >
                    {t("auth.signUp.role.roles.user.title")}
                  </Text>
                  <Text
                    className={`text-sm text-left text-gray-500 ${data.role === 'USER' ? 'text-primary-foreground' : 'text-black'}`}
                  >
                    {t("auth.signUp.role.roles.user.description")}
                  </Text>
                </View>
                <View
                  className={`size-6 border ${data.role === 'USER' ? 'border-primary-foreground' : 'border-gray-300'} items-center justify-center rounded-full bg-white`}>
                  <View
                    className={`${data.role === 'USER' ? 'bg-primary-foreground' : 'bg-white'} size-3 items-center justify-center rounded-full`}></View>
                </View>
              </Pressable>
              <Pressable
                className={`flex-row items-center gap-x-5 rounded-xl p-5 ${data.role === 'MANAGER' ? 'bg-[#F5FFC2]' : 'bg-gray-100'}`}
                onPress={() => setData({ ...data, role: 'MANAGER' })}>
                <IconUsersPlus
                  height={30}
                  width={30}
                  color={data.role === 'MANAGER' ? '#1F4F33' : '#000000'}
                />
                <View className="flex-1">
                  <Text
                    className={`text-[1.2rem] text-left font-semibold ${data.role === 'MANAGER' ? 'text-primary-foreground' : 'text-black'}`}
                  >
                    {t("auth.signUp.role.roles.manager.title")}
                  </Text>
                  <Text
                    className={`text-sm text-left text-gray-500 ${data.role === 'MANAGER' ? 'text-primary-foreground' : 'text-black'}`}
                  >
                    {t("auth.signUp.role.roles.manager.description")}
                  </Text>
                </View>
                <View
                  className={`size-6 border ${data.role === 'MANAGER' ? 'border-primary-foreground' : 'border-gray-300'} items-center justify-center rounded-full bg-white`}>
                  <View
                    className={`${data.role === 'MANAGER' ? 'bg-primary-foreground' : 'bg-white'} size-3 items-center justify-center rounded-full`}></View>
                </View>
              </Pressable>
              <Pressable
                className={`flex-row items-center gap-x-5 rounded-xl p-5 ${data.role === 'OWNER' ? 'bg-[#F5FFC2]' : 'bg-gray-100'}`}
                onPress={() => setData({ ...data, role: 'OWNER' })}>
                <IconSoccerField
                  height={30}
                  width={30}
                  color={data.role === 'OWNER' ? '#1F4F33' : '#000000'}
                />
                <View className="flex-1">
                  <Text
                    className={`text-[1.2rem] text-left font-semibold ${data.role === 'OWNER' ? 'text-primary-foreground' : 'text-black'}`}
                  >
                    {t("auth.signUp.role.roles.owner.title")}
                  </Text>
                  <Text
                    className={`text-sm text-left text-gray-500 ${data.role === 'OWNER' ? 'text-primary-foreground' : 'text-black'}`}
                  >
                    {t("auth.signUp.role.roles.owner.description")}
                  </Text>
                </View>
                <View
                  className={`size-6 border ${data.role === 'OWNER' ? 'border-primary-foreground' : 'border-gray-300'} items-center justify-center rounded-full bg-white`}>
                  <View
                    className={`${data.role === 'OWNER' ? 'bg-primary-foreground' : 'bg-white'} size-3 items-center justify-center rounded-full`}></View>
                </View>
              </Pressable>
            </View>
            <Link asChild href={'/sign-up/name'} disabled={isDisabled}>
              <Button
                className={
                  isDisabled ? 'border-primary/40 bg-primary/40' : 'border-primary bg-primary'
                }>
                <Text className="font-semibold">{t("auth.signUp.role.cta.primary")}</Text>
              </Button>
            </Link>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}
