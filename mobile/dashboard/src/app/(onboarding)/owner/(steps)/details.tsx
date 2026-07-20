import Footer from "@/components/onboarding/Footer";
import Header from "@/components/onboarding/Header";
import Input from "@/components/shared/Input";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import trim from "@/lib/string";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as z from 'zod';

const schema = z.object({
  name: 
      trim("Pitch name is required.")
      .pipe(
          z
              .string()
              .min(2, "Pitch name must be at least 2 characters.").
              max(100, "Pitch name may not exceed 100 characters.")
      ),
  description: 
      trim("Pitch description is required.")
      .pipe(
          z
              .string()
              .refine(
                  val => { const words = val.split(/\s+/).filter(Boolean); return words.length >= 5 && words.length <= 200; },
                  "Pitch description must be between 5 and 200 words."
              )
  ),
  taxId: z
    .string()
    .length(9, "Tax ID must be exactly 9 characters.")
    .regex(/^\d+$/, "Tax ID must contain numbers only.")
    .nullish()
    .or(z.literal("")),
})

export default function Details() {
  const { state, setState } = usePitchDraftForm();
  const insets = useSafeAreaInsets();
  const scroll = useSharedValue(0);

  const handleScroll = useAnimatedScrollHandler((event) => {
      scroll.value = event.contentOffset.y;
  });

  const isValid = schema.safeParse({ ...state }).success;

  return (
    <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 bg-white">
      <KeyboardAwareScrollView
        className="flex-1"
        bottomOffset={100 + insets.bottom}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
      >
        <Header scroll={scroll} progress={5} />
        <View className="px-6 flex-1 pt-3">
          <View className="gap-y-3 mb-10">
            <Text className="text-4xl font-semibold">What is your venue&apos;s name?</Text>
            <Text className="text-gray-500">We need some details about your venue to start creating your pitch.</Text>
          </View>
          <View className="gap-y-6">
            <Input label="Venue Name" placeholder="Name" value={state.name} onChangeText={(text) => setState({ ...state, name: text })} />
            <Input 
              label="Tax ID (Optional)" 
              information="9 digit standard Egyptian business Tax ID. You can set this up later but it will be required to keep operating in the future." 
              placeholder="Tax Identification Number"
              type="number"
              value={state.taxId ?? ""} 
              onChangeText={(text) => setState({ ...state, taxId: text })}
            />
            <Input 
              label="Description" 
              placeholder="Between 5 and 200 words..." 
              multiline 
              numberOfLines={2} 
              value={state.description} 
              onChangeText={(text) => setState({ ...state, description: text })}
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
      <Footer disabled={!isValid} href={"/(onboarding)/owner/(steps)/location"}/>
    </Animated.View>
  );
}