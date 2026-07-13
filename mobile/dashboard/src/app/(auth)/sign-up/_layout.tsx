import { SignUpFormProvider } from "@/context/forms/SignUpContext";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { router, Stack } from "expo-router";
import { Keyboard, Pressable, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Header = () => {
  const handleBack = () => {
    router.back();
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView className="px-6 py-2">
      <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={handleBack}>
        <IconChevronLeft size={18}/>
      </Pressable>
    </SafeAreaView>
  )
};

export default function SignUpLayout() {
  return (
    <SignUpFormProvider>
      <StatusBar barStyle={"dark-content"}/>
      <Stack screenOptions={{ header: () => <Header/>, contentStyle: { backgroundColor: "#FFF" }, gestureEnabled: false }}/>
    </SignUpFormProvider>
  );
}
