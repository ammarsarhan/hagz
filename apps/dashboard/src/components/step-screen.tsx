import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
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
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title subtitle={subtitle} onTitleLayout={compact.onTitleLayout}>
          {title}
        </Title>
        {children}
      </FadingScroll>
    </Screen>
  );
}

// A section's heading within a step (Figma: 22 Semi Bold, 26 above and 12 below). Under a field,
// which keeps 16 below itself, it adds only the rest.
export function SectionHeading({
  children,
  afterField = false,
}: {
  children: string;
  afterField?: boolean;
}) {
  return (
    <Text
      accessibilityRole="header"
      className={`mb-3 ${afterField ? "mt-2.5" : "mt-[26px]"} text-[22px] font-semibold leading-[1.27] tracking-[-0.3px]`}
    >
      {children}
    </Text>
  );
}
