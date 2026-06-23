import { Tabs } from 'expo-router';
import { IconHome, IconSearch, IconUserCircle } from '@tabler/icons-react-native';

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
          tabBarIcon: ({ color, size }) => <IconHome color={color} size={size} strokeWidth={1.75}/>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <IconSearch color={color} size={size} strokeWidth={1.75}/>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <IconUserCircle color={color} size={size} strokeWidth={1.75}/>,
        }}
      />
    </Tabs>
  );
}
