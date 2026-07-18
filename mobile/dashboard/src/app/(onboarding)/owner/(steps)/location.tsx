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
    street: 
        trim("Street name is required.")
        .pipe(
            z
                .string()
                .min(3, "Street name must be more than 3 characters long.")
                .max(100, "Street name must be less than 100 characters long.")
            ),
    areaId: z.
        cuid("Area ID is required."),
    googleMapsLink: z
        .url("Please provide a valid Google Maps link."),
})

export default function Location() {
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
        <Header scroll={scroll} progress={15} />
        <View className="px-6 flex-1 pt-3">
          <View className="gap-y-3 mb-10">
            <Text className="text-4xl font-semibold">Where is your venue located?</Text>
            <Text className="text-gray-500">We will use this information to index your venue, helping users find your pitch.</Text>
          </View>
          <View className="gap-y-6">
            <Input label="Street" placeholder="Street Name" value={state.street} onChangeText={(text) => setState({ ...state, street: text })} />
            <Input 
                label="Area" 
                placeholder="Select Area" 
                information="Please use the area closest to your location. We are constantly working on improving coverage across the country."
                value={state.areaId} 
                onChangeText={(text) => setState({ ...state, areaId: text })} 
            />
            <Input 
                label="Google Maps Link" 
                placeholder="https://www.google.com/maps/place/..." 
                information="Please use the full form of the link. Do not use shortened URLs (e.g. https://maps.app.goo.gl/)."
                value={state.areaId} 
                onChangeText={(text) => setState({ ...state, areaId: text })} 
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
      <Footer disabled={!isValid} href={"/(onboarding)/owner/(steps)/location"}/>
    </Animated.View>
  );
}