import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";

// Where a staff invitation link lands (ROUTES.staffInvitation). The screen itself comes with the
// first-run work: show GET /v1/staff/invitations/code/{code}, then accept or decline.
export default function StaffInvitation() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <Screen>
      <Text className="mt-6 text-subtitle">Invitation {code}</Text>
    </Screen>
  );
}
