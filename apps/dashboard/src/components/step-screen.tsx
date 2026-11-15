import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { CompactTitle, useCompactTitle } from "./compact-title";
import { FadingScroll } from "./fading-scroll";
import { BackButton, NavBar } from "./nav";
import { Screen } from "./screen";
import { Text } from "./text";
import { Title } from "./title";

// One screen of a setup flow: back, the big title (riding beside back once it scrolls away), its
// subtitle, the content, and the buttons pinned to the bottom.
export function StepScreen({
  title,
  subtitle,
  footer,
  navEnd,
  scrollEnabled = true,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  // A button at the end of the nav bar (the opening hours' view switch).
  navEnd?: ReactNode;
  // Off while a finger is dragging something inside (the hours dial).
  scrollEnabled?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const compact = useCompactTitle();
  return (
    <Screen footer={footer}>
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={title}
            style={compact.style}
          />
        }
        end={navEnd}
      />
      <FadingScroll scrollY={compact.scrollY} scrollEnabled={scrollEnabled}>
        <Title subtitle={subtitle} onTitleLayout={compact.onTitleLayout}>
          {title}
        </Title>
        {children}
      </FadingScroll>
    </Screen>
  );
}

// A heading within a step, clearly under the screen's 28 title and above its 16 rows: 20 Semi
// Bold ("Sport", "Booking duration"), with an optional grey line under it saying what it's for. 26
// above and 12 below; under a field, which keeps 16 below itself, it adds only the rest.
export function SectionHeading({
  children,
  description,
  afterField = false,
}: {
  children: string;
  description?: string;
  afterField?: boolean;
}) {
  return (
    <View className={`mb-3 ${afterField ? "mt-2.5" : "mt-[26px]"}`}>
      <Text
        accessibilityRole="header"
        className="text-[20px] font-semibold leading-[1.3] tracking-[-0.2px]"
      >
        {children}
      </Text>
      {description ? (
        <Text className="mt-1 text-label leading-[1.43] text-ink-2">{description}</Text>
      ) : null}
    </View>
  );
}
