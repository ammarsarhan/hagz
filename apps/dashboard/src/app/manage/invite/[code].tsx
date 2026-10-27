import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

// Where a staff invitation link lands (ROUTES.staffInvitation). The screen itself comes with the
// dashboard's sign-in: show GET /v1/staff/invitations/code/{code}, then accept or decline.
export default function StaffInvitation() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Invitation {code}</Text>
    </View>
  );
}
