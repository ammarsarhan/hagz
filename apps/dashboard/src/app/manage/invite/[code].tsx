import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function StaffInvite() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Invite {code}</Text>
    </View>
  );
}
