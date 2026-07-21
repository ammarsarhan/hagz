import Footer from "@/components/onboarding/Footer";
import Header from "@/components/onboarding/Header";
import Input from "@/components/shared/Input";
import LocationModal from "@/components/shared/location/LocationModal";
import { useAuth } from "@/context/AuthContext";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import { client } from "@/lib/client";
import cn from "@/lib/cn";
import { ApiError, parseClientError } from "@/lib/error";
import { useLocations } from "@/lib/hooks/useLocations";
import parseGoogleMapsLink from "@/lib/location";
import trim from "@/lib/string";
import { IconChevronDown, IconMapPin } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View, Text, Pressable, I18nManager, Keyboard, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as z from 'zod';
import useDraftQuery from "@/lib/hooks/useDraftQuery";

const schema = z.object({
    street: 
        trim("Street name is required.")
        .pipe(
            z
                .string()
                .min(3, "Street name must be more than 3 characters long.")
                .max(100, "Street name must be less than 100 characters long.")
            ),
    areaId: z
        .cuid("Area ID is required."),
    googleMapsLink: z
      .url("Please provide a valid URL.")
      .superRefine((value, context) => {
        const parsed = parseGoogleMapsLink(value);

        if (!parsed) {
          context.addIssue({ 
              code: "custom", 
              path: ["googleMapsLink"], 
              message: "Could not identify a valid location or address in this link." 
          });

          return z.NEVER;
        }
      }),
});

export default function Location() {
  const { state, setState } = usePitchDraftForm();
  const { draft } = useDraftQuery();
  const { setUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const locations = useLocations();
  const insets = useSafeAreaInsets();
  const scroll = useSharedValue(0);
  const isRTL = I18nManager.isRTL;

  const handleScroll = useAnimatedScrollHandler((event) => {
      scroll.value = event.contentOffset.y;
  });

  const area = useMemo(() => {
    if (!state.areaId || !locations.data) return undefined;

    for (const governorate of locations.data.locations) {
      const area = governorate.areas.find((a) => a.id === state.areaId);
      if (area) return area;
    };

    return undefined;
  }, [state.areaId, locations.data]);

  const isValid = schema.safeParse({ ...state }).success;

  const createPitchMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...state, taxId: state.taxId?.trim() === "" ? undefined : state.taxId };

      // Make sure the client sends a PATCH if the resource already exists.
      const res = draft
        ? await client.dashboard.pitches[":pitchId"].$patch({
            param: {
              pitchId: draft.pitchId,
            },
            json: payload,
          })
        : await client.dashboard.pitches.$post({
            json: payload,
          });

      if (!res.ok) {
        const error = await parseClientError(res);
        throw new ApiError(error);
      }

      const { data } = await res.json();
      return data.profile;
    },
    onSuccess: (profile) => {
      setUser(profile);
      router.push("/(onboarding)/owner/(steps)/media");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        Alert.alert("Pitch creation failed", err.message);
      } else {
        Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
      }
    },
  });

  const handleSubmit = () => {
    Keyboard.dismiss();
    createPitchMutation.mutate();
  };

  return (
    <>
      <LocationModal 
        location={state.areaId}
        onSelect={(area) => setState({ ...state, areaId: area.id })} 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
      <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 bg-white">
        <KeyboardAwareScrollView
          className="flex-1"
          bottomOffset={120 + insets.bottom}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
        >
          <Header scroll={scroll} progress={20}/>
          <View className="px-6 flex-1 pt-3">
            <View className="gap-y-3 mb-10">
              <Text className="text-4xl font-semibold">Where is your venue located?</Text>
              <Text className="text-gray-500">We will use this information to index your venue, helping users find your pitch.</Text>
            </View>
            <View className="gap-y-6">
              <View className="gap-y-2">
                <Text className="font-medium">Area</Text>
                <Pressable onPress={() => setIsModalOpen(true)} className={cn('min-h-[48px] py-3 w-full flex-row items-center justify-between rounded-lg border border-gray-100 px-3', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                  <View className="flex-row items-center gap-x-2 flex-1 pr-4">  
                    <IconMapPin width={20} height={20} strokeWidth={2} color={"#9CA3AFCC"} />
                    <Text className={cn("flex-1", area ? "text-gray-900" : "text-gray-500")}>
                      {area?.name ?? "Select location"}
                    </Text>
                  </View>
                  <IconChevronDown width={18} height={18} color={"#6B7280"}/>
                </Pressable>
              </View>
              <Input label="Street" placeholder="Street Name" value={state.street} onChangeText={(text) => setState({ ...state, street: text })} />
              <Input 
                  label="Google Maps Link" 
                  placeholder="https://www.google.com/maps/place/..." 
                  information="Please use the full form of the link. Do not use shortened URLs (e.g. https://maps.app.goo.gl/). You can get this from the shortened version by pasting it in a browser."
                  value={state.googleMapsLink} 
                  onChangeText={(text) => setState({ ...state, googleMapsLink: text })} 
                  isDetailed={true}
                  multiline
              />
            </View>
          </View>
        </KeyboardAwareScrollView>
        <Footer disabled={!isValid} isPending={createPitchMutation.isPending} onPress={handleSubmit}/>
      </Animated.View>
    </>
  );
};
