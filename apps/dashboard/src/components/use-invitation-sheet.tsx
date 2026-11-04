import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { LayoutAnimation } from "react-native";
import { pendingInvitation } from "@/lib/pending-invitation";
import { queries } from "@/lib/queries";
import { signOut } from "@/lib/session";
import { InvitationSheet, type SheetStart } from "./invitation-sheet";

// The invitation sheet as a screen uses it: opened from a card, from "Have a code?", or by an
// invitation link (manage/invite/[code]), which can arrive on first run or on a venue's home. Answers
// update the cached venues and invitations, so screens showing them follow.
export function useInvitationSheet({
  phone,
  takeLinks,
  onJoined,
}: {
  phone?: string;
  takeLinks: boolean;
  // After joining, once the sheet has slid away (the venues are refreshed either way).
  onJoined?: () => void;
}) {
  const queryClient = useQueryClient();
  // The sheet's content, kept while it slides away; `open` is what shows or hides it.
  const [start, setStart] = useState<SheetStart | null>(null);
  const [visible, setVisible] = useState(false);
  // Each opening is a fresh sheet, even over one still showing (a second link while the first is up).
  const [key, setKey] = useState(0);
  // What to do once the sheet has slid away.
  const afterSheet = useRef<() => void>(() => undefined);

  const open = useCallback((next: SheetStart) => {
    setStart(next);
    setKey((current) => current + 1);
    setVisible(true);
  }, []);
  const close = (then: () => void) => {
    afterSheet.current = then;
    setVisible(false);
  };

  // Opened from a link: once the screen under it is ready, the sheet looks the code up. On focus,
  // not only on mount: a link opened while this screen is already up lands back on it.
  useFocusEffect(
    useCallback(() => {
      if (!takeLinks) return;
      const link = pendingInvitation.take();
      if (link) open({ link });
    }, [takeLinks, open]),
  );

  // Joined a venue, or found an invitation had ended: which venues they're on and what's still open
  // may both have changed.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
    void queryClient.invalidateQueries({ queryKey: queries.invitations.queryKey });
  };

  const drop = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      queryClient.setQueryData(queries.invitations.queryKey, (current) =>
        current?.filter((invitation) => invitation.id !== id),
      );
    },
    [queryClient],
  );

  // Signed in with the wrong number: sign out, keeping the code, so signing in with the invited
  // number opens it again. Onboarding stays underneath sign-in, as when signing in from the start.
  const switchNumber = async (code: string) => {
    await signOut();
    pendingInvitation.keep(code);
    router.push("/sign-in");
  };

  const sheet =
    start && phone !== undefined ? (
      <InvitationSheet
        key={key}
        start={start}
        phone={phone}
        visible={visible}
        onHidden={() => {
          setStart(null);
          afterSheet.current();
        }}
        onClose={() => close(() => undefined)}
        onJoined={() =>
          close(() => {
            refresh();
            onJoined?.();
          })
        }
        onDeclined={(id) => close(() => drop(id))}
        onSwitchNumber={(code) => void switchNumber(code)}
        onOutdated={refresh}
      />
    ) : null;

  return { open, drop, sheet };
}
