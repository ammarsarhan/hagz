import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Button } from "@/components/button";
import { ChoicePill, ChoicePills } from "@/components/choices";
import { GridKey, HoursGrid } from "@/components/hours-grid";
import type { ScrollController } from "@/components/fading-scroll";
import { useHud } from "@/components/hud";
import { IconCheck, IconCopy } from "@/components/icons";
import { CloseButton, RoundButton } from "@/components/nav";
import { SetupLoading } from "@/components/setup-loading";
import { Sheet } from "@/components/sheet";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { kindOf, type Ground } from "@/lib/grounds";
import {
  blockHours,
  blockLabel,
  paintBlock,
  ringFromApi,
  ringToApi,
  sameRing,
  type CellBlock,
  type Ring,
} from "@/lib/hours";
import { queries } from "@/lib/queries";

// A ground's week (Figma "E1 · Paint the week", 470:11): the whole week as a grid of hours. Tap an
// hour or hold and drag across several, and the footer turns into what to mark them as ("E2 · Mark
// a selection", 470:181): open, peak, discount or closed. Peak and discount only when the ground
// has that price (the API refuses them otherwise).
//
// Marking only changes the grid here; Save sends the whole week (greyed until it differs from
// what's saved). With other grounds to share them with, the saved hours can be copied to them (the
// round button by back; the sheet, "Hours · Copy to other grounds", 357:2).
type Mark = "BASE" | "PEAK" | "DISCOUNT" | "CLOSED";

export default function GroundHours() {
  const { venueId = "", groundId = "" } = useLocalSearchParams<{
    venueId: string;
    groundId: string;
  }>();
  const grounds = useQuery(queries.grounds(venueId));
  const schedule = useQuery(queries.schedule(venueId, groundId));
  if (!grounds.data) return <SetupLoading query={grounds} />;
  if (!schedule.data) return <SetupLoading query={schedule} />;
  const ground = grounds.data.find((g) => g.id === groundId);
  if (!ground) return <SetupLoading query={grounds} />;
  return (
    <WeekScreen
      venueId={venueId}
      ground={ground}
      others={grounds.data.filter((g) => g.id !== groundId)}
      saved={ringFromApi(schedule.data)}
    />
  );
}

function WeekScreen({
  venueId,
  ground,
  others,
  saved,
}: {
  venueId: string;
  ground: Ground;
  others: Ground[];
  saved: Ring;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [ring, setRing] = useState(saved);
  const [selection, setSelection] = useState<CellBlock | null>(null);
  // Kept between selections, so marking several blocks peak is one tap each.
  const [mark, setMark] = useState<Mark | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const scroller = useRef<ScrollController | null>(null);
  const name = ground.name ?? t("screens.setup.grounds.unnamed");
  const changed = !sameRing(ring, saved);

  const marks: Mark[] = [
    "BASE",
    ...(ground.peakPrice !== null ? (["PEAK"] as const) : []),
    ...(ground.discountPrice !== null ? (["DISCOUNT"] as const) : []),
    "CLOSED",
  ];
  const chosen = mark !== null && marks.includes(mark) ? mark : null;

  const apply = () => {
    if (!selection || !chosen) return;
    setRing(paintBlock(ring, selection, chosen === "CLOSED" ? null : chosen));
    setSelection(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const save = async () => {
    setSaving(true);
    const result = await send(
      api.PUT("/v1/staff/venues/{venueId}/grounds/{groundId}/schedule", {
        params: { path: { venueId, groundId: ground.id } },
        body: { days: ringToApi(ring) },
      }),
    );
    if (!result.ok) {
      setSaving(false);
      return hud.show(hudMessage(result.error));
    }
    queryClient.setQueryData(queries.schedule(venueId, ground.id).queryKey, result.data.days);
    // The ground's open hours, the checklist and the draft card all follow.
    void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
    router.back();
  };

  const canCopy = others.length > 0 && !changed && saved.some((tier) => tier !== null);

  return (
    <StepScreen
      title={t("screens.setup.hours.title")}
      subtitle={t("screens.setup.hours.gridSubtitle", { name })}
      scrollEnabled={!dragging}
      scroller={scroller}
      navEnd={
        canCopy ? (
          <RoundButton
            icon={IconCopy}
            label={t("screens.setup.hours.copy")}
            onPress={() => setCopying(true)}
          />
        ) : undefined
      }
      footer={
        selection ? (
          <MarkPanel
            selection={selection}
            marks={marks}
            chosen={chosen}
            name={name}
            ground={ground}
            onMark={setMark}
            onApply={apply}
            onClose={() => setSelection(null)}
          />
        ) : (
          <Button
            label={t("screens.setup.hours.save")}
            disabled={!changed}
            loading={saving}
            onPress={() => void save()}
          />
        )
      }
    >
      <HoursGrid
        ring={ring}
        selection={selection}
        onSelect={setSelection}
        onDragChange={setDragging}
        scroller={scroller}
      />
      <GridKey />

      <CopySheet
        visible={copying}
        venueId={venueId}
        ground={ground}
        name={name}
        others={others}
        onClose={() => setCopying(false)}
      />
    </StepScreen>
  );
}

// What to mark the selected hours as, in place of Save while hours are selected.
function MarkPanel({
  selection,
  marks,
  chosen,
  name,
  ground,
  onMark,
  onApply,
  onClose,
}: {
  selection: CellBlock;
  marks: Mark[];
  chosen: Mark | null;
  name: string;
  ground: Ground;
  onMark: (mark: Mark) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const label = (mark: Mark) =>
    t(
      mark === "BASE"
        ? "screens.setup.hours.open"
        : mark === "PEAK"
          ? "screens.setup.hours.peak"
          : mark === "DISCOUNT"
            ? "screens.setup.hours.discount"
            : "screens.setup.hours.closed",
    );
  // Why a kind of hour is missing from the choices.
  const missing = [
    ground.peakPrice === null ? t("screens.setup.hours.noPeakPrice", { name }) : null,
    ground.discountPrice === null ? t("screens.setup.hours.noDiscountPrice", { name }) : null,
  ].filter((line) => line !== null);

  return (
    <View>
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
            {blockLabel(t, selection)}
          </Text>
          <Text className="mt-1.5 text-label leading-[1.43] text-ink-2">
            {t("screens.setup.hours.selected", { count: blockHours(selection) })}
          </Text>
        </View>
        <CloseButton label={t("screens.setup.hours.clearSelection")} onPress={onClose} />
      </View>
      <View className="mt-4">
        <ChoicePills small spread>
          {marks.map((mark) => (
            <ChoicePill
              small
              key={mark}
              label={label(mark)}
              selected={chosen === mark}
              onPress={() => onMark(mark)}
            />
          ))}
        </ChoicePills>
      </View>
      {missing.map((line) => (
        <Text key={line} className="mt-3 text-caption text-ink-2">
          {line}
        </Text>
      ))}
      <View className="mt-5">
        <Button
          label={t("screens.setup.hours.apply")}
          disabled={chosen === null}
          onPress={onApply}
        />
      </View>
    </View>
  );
}

// Copying a ground's week to others (Figma 357:2): a one-time copy, not a link; each keeps its own
// prices. The API refuses the lot if one of them lacks a price the week uses.
function CopySheet({
  visible,
  venueId,
  ground,
  name,
  others,
  onClose,
}: {
  visible: boolean;
  venueId: string;
  ground: Ground;
  name: string;
  others: Ground[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const copy = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/grounds/{groundId}/schedule/copy", {
        params: { path: { venueId, groundId: ground.id } },
        body: { groundIds: [...picked] },
      }),
    );
    setSending(false);
    if (!result.ok) return hud.show(hudMessage(result.error));
    void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => setPicked(new Set())}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.setup.hours.copyTitle", { name })}
      </Text>
      <Text className="mb-4 mt-3 text-subtitle text-ink-2">
        {t("screens.setup.hours.copyBody", { name })}
      </Text>
      <View className="border-t border-border">
        {others.map((other) => {
          const checked = picked.has(other.id);
          const otherName = other.name ?? t("screens.setup.grounds.unnamed");
          return (
            <Pressable
              key={other.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={otherName}
              onPress={() => toggle(other.id)}
              className="flex-row items-center gap-3 border-b border-border py-[15px] active:opacity-60"
            >
              <View className="flex-1">
                <Text className="text-subtitle font-medium leading-[1.31]">{otherName}</Text>
                <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">
                  {`${kindOf(t, other)} · ${t(`screens.setup.grounds.environments.${other.environment}`)}`}
                </Text>
              </View>
              <View
                className={`size-[22px] items-center justify-center rounded-[6px] ${checked ? "bg-primary" : "border-[1.5px] border-border"}`}
              >
                {checked ? <IconCheck size={16} color={colors.white} strokeWidth={2.5} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-6">
        <Button
          label={
            picked.size === 0
              ? t("screens.setup.hours.copyPick")
              : t("screens.setup.hours.copyTo", { count: picked.size })
          }
          disabled={picked.size === 0}
          loading={sending}
          onPress={() => void copy()}
        />
      </View>
    </Sheet>
  );
}
