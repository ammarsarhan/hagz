import type { components } from "@hagz/api";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSignInSheet } from "@/components/sign-in-sheet";
import { Text } from "@/components/text";
import { api, auth } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { resetOnboarding } from "@/lib/onboarding";
import { signOut } from "@/lib/session";

type Customer = components["schemas"]["Customer"];

// Where a guest lands after onboarding. A placeholder until Phase 3's Home: lime and black from the
// customer theme. It says who's signed in, with Sign out, until the Account tab has them. Development
// builds can replay onboarding, try the guest sign-in sheet, and open a venue page by its slug (until
// search lists venues) from here.
export default function Home() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const { whenSignedIn, sheet } = useSignInSheet("/home");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!(await auth.isSignedIn())) {
          if (active) setCustomer(null);
          return;
        }
        const result = await send(api.GET("/v1/customers/me"));
        if (active && result.ok) setCustomer(result.data);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-primary">
      <Text className="text-title font-semibold text-on-primary">Hagz</Text>
      {customer ? (
        <>
          <Text className="text-subtitle text-on-primary">Signed in as {customer.name}</Text>
          <Link label="Sign out" onPress={() => void signOut().then(() => setCustomer(null))} />
        </>
      ) : (
        <Link label="Sign in" onPress={() => router.push("/sign-in")} />
      )}
      {__DEV__ ? (
        <>
          <Link
            label="Try the sign-in sheet"
            onPress={() =>
              void whenSignedIn(() => undefined, {
                title: "Sign in to book",
                body: (
                  <>
                    Create an account or sign in to book{" "}
                    <Text className="text-ink">Pitch 2 at 9:00 pm</Text>. You’ll come straight back
                    here.
                  </>
                ),
              })
            }
          />
          <Link
            label="Open a venue page"
            onPress={() =>
              Alert.prompt("Open a venue page", "The venue's slug, from /venue/[slug].", (slug) => {
                const trimmed = slug.trim();
                if (trimmed) router.push({ pathname: "/venue/[slug]", params: { slug: trimmed } });
              })
            }
          />
          <Link
            label="Show onboarding again"
            onPress={() => {
              resetOnboarding();
              router.replace("/");
            }}
          />
        </>
      ) : null}
      {sheet}
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      className="active:opacity-60"
    >
      <Text className="text-subtitle font-medium text-on-primary underline">{label}</Text>
    </Pressable>
  );
}
