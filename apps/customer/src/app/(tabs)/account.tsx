import type { components } from "@hagz/api";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { api, auth } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { signOut } from "@/lib/session";

type Customer = components["schemas"]["Customer"];

// The Account tab until its screens are designed: who's signed in with Sign out, or, for a guest,
// Create account (lime, a big moment) and Sign in. Read again each time the tab is opened, so it
// follows signing in elsewhere.
export default function AccountTab() {
  // Undefined while checking; null for a guest.
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!(await auth.isSignedIn())) {
          if (active) setCustomer(null);
          return;
        }
        const result = await send(api.GET("/v1/customers/me"));
        if (active) setCustomer(result.ok ? result.data : null);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white px-6">
      <View className="mt-6 gap-2">
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          Account
        </Text>
        {customer === undefined ? null : (
          <Text className="text-subtitle text-ink-2">
            {customer
              ? `Signed in as ${customer.name}.`
              : "Create an account or sign in to book and keep your bookings."}
          </Text>
        )}
      </View>
      {customer === undefined ? null : (
        <View className="mt-8 gap-2.5">
          {customer ? (
            <Button
              label="Sign out"
              variant="secondary"
              onPress={() => void signOut().then(() => setCustomer(null))}
            />
          ) : (
            <>
              <Button
                label="Create account"
                variant="moment"
                onPress={() => router.push("/sign-up")}
              />
              <Button label="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} />
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
