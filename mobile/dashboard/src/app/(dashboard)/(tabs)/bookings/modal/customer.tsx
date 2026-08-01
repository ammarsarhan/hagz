import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import { useCreateBooking } from "@/context/forms/CreateBookingContext";
import { usePitch, useRequiredPitch } from "@/context/PitchContext";
import { client } from "@/lib/client";
import useDebounce from "@/lib/hooks/useDebounce";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Customer() {
    const { pitch } = useRequiredPitch();
    const { state, setState } = useCreateBooking();

    const phone = useDebounce(state.customer.phone, 400);

    const query = useQuery({
        queryKey: ["customer", pitch.id, phone],
        queryFn: async () => {
            try {
                const res = await client.dashboard.pitches[":pitchId"].customers.$get({
                    param: { pitchId: pitch!.id },
                    query: { phone: `+20${phone}` },
                });

                if (!res.ok) return null;

                const { data } = await res.json();
                return data;
            } catch {
                return null;
            }
        },
        enabled: phone.length === 10,
        retry: false,
    });

    const exists = !!query.data?.customer;

    const disabled =
        phone.length !== 10 ||
        state.customer.firstName.trim() === "" ||
        state.customer.lastName.trim() === "";

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <Pressable className="flex-1 p-6" onPress={Keyboard.dismiss}>
                    <View className="flex-row items-center justify-between mb-3">
                        <Pressable
                            className="size-11 items-center justify-center rounded-full bg-gray-100"
                            onPress={router.back}
                        >
                            <IconChevronLeft size={18} />
                        </Pressable>
                    </View>
                    <View className="gap-y-3 py-2 mb-8">
                        <Text className="text-3xl font-semibold">
                            What is your customer&apos;s phone number?
                        </Text>
                        <Text className="text-gray-500">
                            We&apos;ll use it to identify the customer, keep track of their
                            bookings, and make future reservations faster.
                        </Text>
                    </View>
                    <View className="gap-y-6">
                        <View className="gap-y-3">
                            <Input
                                placeholder="e.g. 1023045006"
                                label="Phone Number"
                                type="phone"
                                value={state.customer.phone}
                                onChangeText={(phone) =>
                                    setState((prev) => ({
                                        ...prev,
                                        customer: {
                                            phone,
                                            firstName: "",
                                            lastName: "",
                                        },
                                    }))
                                }
                            />
                            {
                                exists &&
                                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}> 
                                    <Text className="text-gray-500 text-[0.95rem]">{query.data?.customer?.firstName} has booked here previously and is a verified recurring customer.</Text>
                                </Animated.View>
                            }
                        </View>
                        <View className="flex-row gap-x-4">
                            <Input
                                type="text"
                                label="First Name"
                                placeholder="First Name"
                                containerClassName="flex-1"
                                editable={!exists}
                                value={
                                    exists
                                        ? query.data?.customer?.firstName ?? ""
                                        : state.customer.firstName
                                }
                                onChangeText={(firstName) =>
                                    setState((prev) => ({
                                        ...prev,
                                        customer: {
                                            ...prev.customer,
                                            firstName,
                                        },
                                    }))
                                }
                            />
                            <Input
                                type="text"
                                label="Last Name"
                                placeholder="Last Name"
                                containerClassName="flex-1"
                                editable={!exists}
                                value={
                                    exists
                                        ? query.data?.customer?.lastName ?? ""
                                        : state.customer.lastName
                                }
                                onChangeText={(lastName) =>
                                    setState((prev) => ({
                                        ...prev,
                                        customer: {
                                            ...prev.customer,
                                            lastName,
                                        },
                                    }))
                                }
                            />
                        </View>
                    </View>
                </Pressable>
            </KeyboardAvoidingView>
            <View className="absolute bottom-10 right-6 z-10">
                <Link asChild href="/(dashboard)/(tabs)/bookings/modal/slots">
                    <Button className="border-primary bg-primary px-8" disabled={disabled}>
                        <Text className="text-white font-medium">Continue</Text>
                    </Button>
                </Link>
            </View>
        </SafeAreaView>
    );
};
