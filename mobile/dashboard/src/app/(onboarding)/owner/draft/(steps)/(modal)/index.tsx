import { useEffect, useReducer } from "react";
import {
    GroundDraftType,
    sportMap,
    sizeMap,
    surfaceMap,
    getSizeOptions,
    getSurfaceOptions,
    GroundSport,
    GroundSize,
    GroundSurface,
} from "@/lib/types/ground";
import { IconTrash, IconX } from "@tabler/icons-react-native";
import { Pressable, View, Text, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import Input from "@/components/shared/Input";
import GroundPill from "@/components/onboarding/GroundPill";
import Button from "@/components/shared/Button";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as z from "zod";
import trim from "@/lib/string";
import { router, useLocalSearchParams } from "expo-router";
import { DraftGround, useGrounds } from "@/lib/hooks/useGrounds";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";

const sportValues = Object.keys(sportMap) as [GroundSport, ...GroundSport[]];
const sizeValues = Object.keys(sizeMap) as [GroundSize, ...GroundSize[]];
const surfaceValues = Object.keys(surfaceMap) as [GroundSurface, ...GroundSurface[]];

const schema = z.object({
    name: trim("Ground name is required.")
        .pipe(
            z.string()
                .min(2, "Ground name must be at least 2 characters.")
                .max(100, "Ground name may not exceed 100 characters.")
        ),
    description: trim("Ground description must be valid text.")
        .pipe(
            z.string()
                .refine(
                    val => {
                        const words = val.split(/\s+/).filter(Boolean);
                        return words.length >= 5 && words.length <= 200;
                    },
                    "Ground description must be between 5 and 200 words."
                )
        )
        .optional(),
    sport: z.enum(sportValues, "Please choose a valid ground sport type."),
    size: z.enum(sizeValues, "Please choose a valid ground size type."),
    surface: z.enum(surfaceValues, "Please choose a valid ground surface type."),
    basePrice: z
        .number("Ground must have a valid base price set.")
        .min(50, "Base ground price may not be less than 50 EGP per hour.")
        .max(2000, "Base ground price may not be more than 2000 EGP per hour."),
    peakPrice: z
        .number()
        .min(100, "Peak ground price may not be less than 100 EGP per hour.")
        .max(2500, "Ground price may not be more than 2500 EGP per hour.")
        .optional(),
    discountPrice: z
        .number("Ground must have a valid base price set.")
        .min(25, "Ground price may not be less than 25 EGP per hour.")
        .max(1500, "Ground price may not be more than 1500 EGP per hour.")
        .optional()
});

const base: GroundDraftType = {
    name: "",
    sport: "FOOTBALL",
    size: "FIVE_A_SIDE",
    surface: "NATURAL_GRASS",
    basePrice: 100,
    description: undefined,
    peakPrice: undefined,
    discountPrice: undefined,
};

type FormAction =
    | { type: "RESET"; payload: GroundDraftType }
    | { type: "SET_SPORT"; sport: GroundDraftType["sport"] }
    | { type: "SET_FIELD"; field: keyof GroundDraftType; value: GroundDraftType[keyof GroundDraftType] };

function formReducer(state: GroundDraftType, action: FormAction): GroundDraftType {
    switch (action.type) {
        case "RESET":
            return action.payload;
        case "SET_SPORT": {
            const sizeOptions = getSizeOptions(action.sport);
            const surfaceOptions = getSurfaceOptions(action.sport);
            return {
                ...state,
                sport: action.sport,
                size: sizeOptions.includes(state.size) ? state.size : sizeOptions[0],
                surface: surfaceOptions.includes(state.surface) ? state.surface : surfaceOptions[0],
            };
        }
        case "SET_FIELD":
            return { ...state, [action.field]: action.value };
        default:
            return state;
    }
}

const fadeIn = FadeIn.duration(180);
const fadeOut = FadeOut.duration(120);

export default function Index() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const { draft } = useDraftQuery();
    const { state } = usePitchDraftForm();
    const pitchId = draft?.pitchId;

    const { createMutation, updateMutation, removeMutation } = useGrounds(pitchId!);

    const grounds = state.grounds as DraftGround[];
    const initialValue = id ? grounds.find((g) => g.id === id) : undefined;

    const isEdit = !!initialValue;
    const [form, dispatch] = useReducer(formReducer, initialValue ?? base);

    useEffect(() => {
        dispatch({ type: "RESET", payload: initialValue ?? base });
    }, [initialValue]);

    const setField = <K extends keyof GroundDraftType>(field: K, value: GroundDraftType[K]) => {
        dispatch({ type: "SET_FIELD", field, value });
    };

    const sizeOptions = getSizeOptions(form.sport);
    const surfaceOptions = getSurfaceOptions(form.sport);

    const canSave = schema.safeParse(form).success;

    const handleSave = () => {
        if (!canSave) return;
        if (isEdit && id) {
            updateMutation.mutate({ id, ground: form }, { onSuccess: () => router.push({ pathname: "/(onboarding)/owner/draft/(steps)/(modal)/schedule", params: { groundId: id } }) });
        } else {
            createMutation.mutate(form, {
                onSuccess: (ground) => {
                    router.setParams({ id: ground.id });
                    router.push({ pathname: "/(onboarding)/owner/draft/(steps)/(modal)/schedule", params: { groundId: ground.id } });
                },
            });
        }
    };

    const handleRemove = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            "Remove ground",
            "Are you sure you want to delete this ground?",
            [
                { text: "Cancel" },
                { text: "Delete", style: "destructive", onPress: () => {
                    if (id) {
                        removeMutation.mutate(id);
                        router.back();
                    }
                }}
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <KeyboardAwareScrollView
                className="flex-1"
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingHorizontal: 24,
                    paddingTop: 24,
                    paddingBottom: 24
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bottomOffset={32}
            >
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={router.back}
                    >
                        <IconX size={18} />
                    </Pressable>
                    {
                        isEdit && (
                            <Pressable
                                onPress={handleRemove}
                                className="p-2 border rounded-full border-gray-200"
                            >
                                <IconTrash size={20} color="#6B7280" />
                            </Pressable>
                        )
                    }
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">
                        {isEdit ? "Edit" : "Add"} {isEdit && form.name ? form.name : "Ground"}
                    </Text>
                    <Text className="text-gray-500">
                        {isEdit
                            ? "Update your ground details, settings, schedule, and pricing."
                            : "Add your ground details and set up your schedule and pricing."}
                    </Text>
                </View>
                <View className="flex-1 gap-y-12">
                    <View className="gap-y-2">
                        <Text className="font-medium">Sport</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {Object.keys(sportMap).map(sport => (
                                <GroundPill
                                    key={sport}
                                    meta={sportMap[sport as GroundSport]}
                                    selected={form.sport === sport}
                                    onPress={() => dispatch({ type: "SET_SPORT", sport: sport as GroundSport })}
                                />
                            ))}
                        </View>
                    </View>
                    <Input
                        label="Name"
                        placeholder="e.g. Ground A"
                        value={form.name}
                        onChangeText={value => setField("name", value)}
                    />
                    <Input
                        label="Description (Optional)"
                        placeholder="e.g. Our most popular ground for competitive 5-a-side matches."
                        information="Use this field to add additional details that are specific to this ground, rather than its amenities."
                        multiline
                        value={form.description ?? ""}
                        onChangeText={value => setField("description", value || undefined)}
                    />
                    <View className="gap-y-2">
                        <Text className="font-medium">Ground Size</Text>
                        <Animated.View
                            key={`size-${form.sport}`}
                            entering={fadeIn}
                            exiting={fadeOut}
                            className="flex-row flex-wrap gap-2"
                        >
                            {sizeOptions.map(size => (
                                <GroundPill
                                    key={size}
                                    meta={sizeMap[size]}
                                    selected={form.size === size}
                                    onPress={() => setField("size", size)}
                                />
                            ))}
                        </Animated.View>
                    </View>
                    <View className="gap-y-2">
                        <Text className="font-medium">Surface</Text>
                        <Animated.View
                            key={`surface-${form.sport}`}
                            entering={fadeIn}
                            exiting={fadeOut}
                            className="flex-row flex-wrap gap-2"
                        >
                            {surfaceOptions.map(surface => (
                                <GroundPill
                                    key={surface}
                                    meta={surfaceMap[surface]}
                                    selected={form.surface === surface}
                                    onPress={() => setField("surface", surface)}
                                />
                            ))}
                        </Animated.View>
                    </View>
                    <Input
                        label="Base Price"
                        placeholder="e.g. 100"
                        type="price"
                        information="This is your standard baseline price across most of your hours. Must be at least EGP 50.00/hr."
                        value={form.basePrice ? String(form.basePrice) : ""}
                        onChangeText={value => setField("basePrice", Number(value) || 0)}
                    />
                    <Input
                        label="Peak Price (Optional)"
                        placeholder="e.g. 125"
                        type="price"
                        information="This is your increased price for in-demand hours like Thursday 6-8 PM. Must be greater than your base price."
                        value={form.peakPrice ? String(form.peakPrice) : ""}
                        onChangeText={value => setField("peakPrice", value ? Number(value) : undefined)}
                    />
                    <Input
                        label="Discount Price (Optional)"
                        placeholder="e.g. 50"
                        type="price"
                        information="This is your discounted pricing for unbooked hours like Tuesday 1-3PM. Must be less than your base price."
                        value={form.discountPrice ? String(form.discountPrice) : ""}
                        onChangeText={value => setField("discountPrice", value ? Number(value) : undefined)}
                    />
                </View>
            </KeyboardAwareScrollView>
            <View className="px-6 pb-8 pt-4">
                <Button
                    className="bg-primary border-primary"
                    disabled={!canSave}
                    loading={createMutation.isPending || updateMutation.isPending}
                    onPress={handleSave}
                >
                    <Text className="font-medium text-white">
                        {isEdit ? "Next" : "Create Ground"}
                    </Text>
                </Button>
            </View>
        </SafeAreaView>
    );
}
