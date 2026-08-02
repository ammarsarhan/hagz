import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import { useBookingMutation, useCreateBooking } from "@/context/forms/CreateBookingContext";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { Alert, Pressable, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/lib/error";
import { BookingCheckoutPayload, BookingDirectPayload } from "@/lib/types/bookings";
import { useRequiredPitch } from "@/context/PitchContext";
import { useQueryClient } from "@tanstack/react-query";

export default function Notes() {
    const { state, setState } = useCreateBooking();
    const { pitch } = useRequiredPitch();
    const queryClient = useQueryClient();
    
    const mutation = useBookingMutation();

    const handleSubmit = () => {
        const basePayload = {
            startTime: state.startTime,
            endTime: state.endTime,
            paymentMethod: state.paymentMethod,
            channel: state.channel,
            customer: {
                firstName: state.customer.firstName.trim() !== "" ? state.customer.firstName : undefined,
                lastName: state.customer.lastName.trim() !== "" ? state.customer.lastName : undefined,
                phone: `+20${state.customer.phone}`
            },
        };

        const payload: BookingDirectPayload | BookingCheckoutPayload = state.isPaid
            ? { ...basePayload, paymentNote: state.paymentNote }
            : basePayload;

        mutation.mutate(
            { pitchId: pitch.id, groundId: state.groundId!, isPaid: state.isPaid, payload },
            {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: ["bookings", pitch.id] });
                    router.dismissTo("/(dashboard)/(tabs)/bookings");
                },
                onError: (err) => {
                    if (err instanceof ApiError) {
                        Alert.alert("Couldn't add booking", err.message);
                    } else {
                        Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
                    }
                },
            }
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <View className="flex-1 p-6">
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={router.back}
                    >
                        <IconChevronLeft size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">Any additional notes?</Text>
                    <Text className="text-gray-500">
                        You can leave a note for your records, such as a discount reason or a special arrangement made with the customer.
                    </Text>
                </View>
                <View className="gap-y-4 mb-10">
                    <Input
                        type="text"
                        multiline
                        numberOfLines={6}
                        minHeight={140}
                        label="Payment Note"
                        placeholder="e.g. 10% discount agreed over the phone"
                        value={state.paymentNote}
                        onChangeText={(paymentNote) => setState({ ...state, paymentNote })}
                    />
                </View>
                <View className="flex-row justify-end">
                    <Button
                        className="bg-primary border-primary"
                        loading={mutation.isPending}
                        onPress={handleSubmit}
                    >
                        <Text className="font-medium text-white">Add Booking</Text>
                    </Button>
                </View>
            </View>
        </SafeAreaView>
    )
};
