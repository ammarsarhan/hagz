import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import './global.css';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView className='flex-1 h-screen items-center justify-center bg-white'>
        <Text>Hello world from Hagz!</Text>
      </SafeAreaView>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
