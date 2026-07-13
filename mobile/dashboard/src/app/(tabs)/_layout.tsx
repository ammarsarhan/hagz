import ErrorView from "@/components/shared/ErrorView";
import { useAuth } from "@/context/AuthContext";
import { Tabs } from "expo-router";
import { StatusBar, Text } from "react-native";

export default function TabLayout() {
  const { user, signOut } = useAuth();
  const isUser = user && user.preferences.role === "USER";

  if (isUser) {
    return (
      <ErrorView 
        title="You are not authorized to access the dashboard"
        description="You are signed in with a user account. If you still wish to access the dashboard, transfer to a staff account first. If you did not expect to receive this error, please get in touch with customer service."
        actionProps={{ 
          children: <Text className="font-medium text-white">Sign Out</Text>, 
          className: "bg-black border-black",
          onPress: signOut
        }}
      />
    )
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Tabs screenOptions={{ headerShown: false }} />
    </>
  );
}
