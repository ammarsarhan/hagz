import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Screen } from "@/components/screen";
import { auth } from "@/lib/api";
import { colors } from "@/lib/colors";
import { resetTo } from "@/lib/navigation";
import { pendingInvitation } from "@/lib/pending-invitation";

// Where a staff invitation link lands (ROUTES.staffInvitation). Nothing is shown here: the code is
// kept and first run opens it in the invitation sheet (Figma "D2 · Invitation link"). Signed out, the
// way there is onboarding and signing in or up, which land on first run too.
export default function StaffInvitation() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    if (code) pendingInvitation.keep(code);
    void auth.isSignedIn().then((signedIn) => resetTo(signedIn ? "/home" : "/"));
  }, [code]);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.ink3} />
      </View>
    </Screen>
  );
}
