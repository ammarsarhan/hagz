import { type Href } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { auth } from "@/lib/api";
import { push, signInFrom } from "@/lib/navigation";
import { Button } from "./button";
import { Sheet } from "./sheet";
import { Text } from "./text";

interface Ask {
  // "Sign in to book"
  title: string;
  // What they were doing, so they know what comes back: "…to book Pitch 2 at 9:00 pm."
  body: ReactNode;
}

// Guests browse freely; something that needs an account (booking, a favourite) asks for one in a
// sheet over the screen, with Create account (lime: it's a big moment) and Sign in. Either one comes
// back to `from` once they're in (lib/navigation.ts).
//
//   const { whenSignedIn, sheet } = useSignInSheet("/venue/abc");
//   onPress={() => whenSignedIn(book, { title: "Sign in to book", body: … })}
//   …and render {sheet} in the screen.
export function useSignInSheet(from: Href) {
  const { t } = useTranslation();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [open, setOpen] = useState(false);
  // Where to go once the sheet has slid away: a screen can't be pushed under a Modal that's still
  // up, so it waits for onHidden.
  const next = useRef<Href | null>(null);

  const whenSignedIn = useCallback(async (action: () => void, prompt: Ask) => {
    if (await auth.isSignedIn()) {
      action();
      return;
    }
    setAsk(prompt);
    setOpen(true);
  }, []);

  const go = (href: Href) => {
    next.current = href;
    setOpen(false);
  };

  const sheet = ask ? (
    <Sheet
      visible={open}
      onClose={() => setOpen(false)}
      onHidden={() => {
        setAsk(null);
        const href = next.current;
        next.current = null;
        if (!href) return;
        signInFrom(from);
        push(href);
      }}
    >
      <Text className="mb-1.5 text-heading font-semibold">{ask.title}</Text>
      <Text className="text-subtitle text-ink-2">{ask.body}</Text>
      <View className="mt-6 gap-2.5">
        <Button
          label={t("common.actions.createAccount")}
          variant="moment"
          onPress={() => go("/sign-up")}
        />
        <Button
          label={t("common.actions.signIn")}
          variant="secondary"
          onPress={() => go("/sign-in")}
        />
      </View>
    </Sheet>
  ) : null;

  return { whenSignedIn, sheet };
}
