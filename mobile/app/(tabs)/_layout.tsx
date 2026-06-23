import { Tabs } from 'expo-router';
import { IconHome, IconSettings } from '@tabler/icons-react-native';

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: '#1F4F33', 
        headerShown: false,
        sceneStyle: {
          backgroundColor: 'white'
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <IconHome color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <IconSettings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
