import { Tabs } from 'expo-router';
import { IconHistory, IconHome, IconSearch, IconUserCircle } from '@tabler/icons-react-native';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'react-native';

export default function UserLayout() {
  const { t } = useTranslation();

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#1F4F33',
          headerShown: false,
          sceneStyle: {
            backgroundColor: 'white',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('user.layout.home'),
            tabBarIcon: ({ color, size }) => (
              <IconHome color={color} size={size} strokeWidth={1.75} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: t('user.layout.search'),
            tabBarIcon: ({ color, size }) => (
              <IconSearch color={color} size={size} strokeWidth={1.75} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t('user.layout.history'),
            tabBarIcon: ({ color, size }) => (
              <IconHistory color={color} size={size} strokeWidth={1.75} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('user.layout.profile'),
            tabBarIcon: ({ color, size }) => (
              <IconUserCircle color={color} size={size} strokeWidth={1.75} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
