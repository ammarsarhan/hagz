import Button from "@/components/shared/Button";
import { useAuth } from "@/context/AuthContext";
import { client } from "@/lib/client";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { ApiError, parseClientError } from "@/lib/error";

export default function Transfer() {
    const { setUser } = useAuth();

    const transferMutation = useMutation({
        mutationFn: async () => {
            const res = await client.app.profile.transfer.$post({ json: { role: "MANAGER" } });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data.profile;
        },
        onSuccess: (profile) => {
            setUser(profile);
        },
        onError: (err) => {
            console.log(err);

            if (err instanceof ApiError) {
                Alert.alert("Account transfer failed", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
    });

    return (
        <SafeAreaView className="flex-1 p-6">
            <View className="mb-3">
                <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={() => router.back()}>
                    <IconChevronLeft size={18}/>
                </Pressable>
            </View>
            <View className="gap-y-1 py-2 mb-10">
                <Text className="text-3xl font-semibold">Change Role</Text> 
                <Text className="text-gray-500">Switch your account role to a manager.</Text> 
                <View className="py-8">  
                    <Button className="bg-primary border-primary" loading={transferMutation.isPending} onPress={() => transferMutation.mutate()}>
                        <Text className="text-white font-medium">Transfer Account</Text>
                    </Button>
                </View>
                <Text className="text-gray-500 text-sm">
                    Changing your account to a manager account will require that you have a valid pending invitation associated with this phone number to join a venue.
                </Text>
            </View>
        </SafeAreaView>
    )
};
