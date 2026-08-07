import { formatCurrency } from "@/lib/string";
import { IconMinus, IconPlus, IconX } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import * as Haptics from 'expo-haptics';
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import { useRequiredPitch } from "@/context/PitchContext";
import { useLedgerMutation } from "@/lib/hooks/payments";
import { ApiError } from "@/lib/error";

export default function Record() {
    const [amount, setAmount] = useState(-100);
    const [note, setNote] = useState("");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { pitch } = useRequiredPitch();
    const mutation = useLedgerMutation();

    const startDecrement = () => {
        handleDecrement(5);

        intervalRef.current = setInterval(() => {
            handleDecrement(5);
        }, 100);
    };

    const stopDecrement = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const startIncrement = () => {
        handleIncrement(5);

        intervalRef.current = setInterval(() => {
            handleIncrement(5);
        }, 100);
    };

    const stopIncrement = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const handleDecrement = async (value: number = 1) => {
        setAmount(prev => {
            if (prev <= -5000) {
                stopDecrement();
                return prev;
            }

            return Math.max(prev - value, -5000);
        });

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleIncrement = async (value: number = 1) => {
        setAmount(prev => {
            if (prev >= 0) {
                stopIncrement();
                return prev;
            }

            return Math.min(prev + value, 0);
        });

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleSubmit = () => {
        mutation.mutate(
            {
                pitchId: pitch.id,
                payload: { amount, note },
            },
            {
                onSuccess: () => {
                    router.back();
                },
                onError: (err) => {
                    if (err instanceof ApiError) {
                        Alert.alert("Couldn't record adjustment", err.message);
                    } else {
                        Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
                    }
                },
            }
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-6 pb-28"
                keyboardShouldPersistTaps="handled"
            >
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={router.back}
                    >
                        <IconX size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">Record adjustment</Text>
                    <Text className="text-gray-500">
                        Add a custom payment entry adjustment for this venue.
                    </Text>
                </View>
                <View className="gap-y-4 mb-6">
                    <Text className="font-medium">Amount</Text>
                    <View className="flex-1 flex-row items-center gap-x-6">
                        <Pressable
                            className="size-11 rounded-full bg-gray-100 items-center justify-center"
                            onPress={() => handleDecrement()}
                            onLongPress={startDecrement}
                            onPressOut={stopDecrement}
                            delayLongPress={500}
                        >
                            <IconMinus width={18} height={18} />
                        </Pressable>
                        <View className="flex-1 items-center justify-center">
                            <Text className="text-3xl font-semibold">
                                {formatCurrency(amount)}
                            </Text>
                        </View>
                        <Pressable
                            className="size-11 rounded-full bg-gray-100 items-center justify-center"
                            onPress={() => handleIncrement()}
                            onLongPress={startIncrement}
                            onPressOut={stopIncrement}
                            delayLongPress={500}
                        >
                            <IconPlus width={18} height={18} />
                        </Pressable>
                    </View>
                    <Slider
                        minimumValue={-5000}
                        maximumValue={0}
                        step={5}
                        value={amount}
                        onValueChange={setAmount}
                        minimumTrackTintColor="#2563eb"
                    />
                </View>
                <View className="gap-y-4 mb-8">
                    <Input
                        type="text"
                        multiline
                        numberOfLines={6}
                        minHeight={140}
                        label="Note (Required)"
                        placeholder="e.g. Reversed the addition of 50.00 EGP by mistake."
                        value={note}
                        onChangeText={(value) => setNote(value)}
                    />
                    <Text className="text-gray-500 text-sm">
                        This information will be used in case an audit trail is needed. Please make sure it is filled out as descriptively and accurately as possible.
                    </Text>
                </View>
                <View className="flex-row justify-end">
                    <Button
                        className="bg-primary border-primary px-6"
                        disabled={note.length <= 2 || amount === 0}
                        loading={mutation.isPending}
                        onPress={handleSubmit}
                    >
                        <Text className="text-white font-medium text-[0.95rem]">Adjust</Text>
                    </Button>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
};
