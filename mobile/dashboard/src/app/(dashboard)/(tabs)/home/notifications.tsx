import Button from "@/components/shared/Button";
import NotificationItem from "@/components/tabs/NotificationItem";
import { useRequiredAuth } from "@/context/AuthContext";
import { useNotificationsQuery, useReadNotificationsMutation } from "@/lib/hooks/notifications/useNotifications";
import { IconBellCheck, IconBellOff, IconX } from "@tabler/icons-react-native";
import { Link, router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Header = () => (
    <View className="p-6">
        <View className="flex-row items-center justify-between">
            <Pressable
                className="size-11 items-center justify-center rounded-full bg-gray-100"
                onPress={router.back}
            >
                <IconX size={18} />
            </Pressable>
        </View>
        <View className="py-2 mt-3 gap-y-1">
            <Text className="text-3xl font-semibold">Notifications</Text>
            <Text className="text-gray-500">View notifications for your venue.</Text>
        </View>
    </View>
);

export default function Notifications() {
    const { user } = useRequiredAuth();

    const { data } = useNotificationsQuery(user.id);
    const mutation = useReadNotificationsMutation(user.id);

    const isAllowed = user.preferences.notifications.includes("IN_APP");
    const hasData = isAllowed && data && (data.notifications.length ?? 0) > 0;

    const renderGuard = () => (
        <View className="items-center justify-center gap-y-4 px-6">
            <View className="rounded-full size-16 items-center justify-center bg-gray-100">
                <IconBellOff width={24} height={24}/>
            </View>
            <View className="gap-y-2 my-4">
                <Text className="font-semibold text-2xl text-center">No in-app notifications</Text>
                <Text className="text-center text-gray-500">You do not have in-app notifications enabled. You can change this from your profile settings.</Text>
            </View>
            <Link asChild href="/(dashboard)/profile/notifications"> 
                <Button className="px-8">
                    <Text className="font-medium text-primary">Allow notifications</Text>
                </Button>
            </Link>
        </View>
    );

    const renderContent = () => (
        <View className="items-center justify-center gap-y-4 px-6">
            <View className="rounded-full size-16 items-center justify-center bg-gray-100">
                <IconBellCheck width={24} height={24}/>
            </View>
            <Text className="font-semibold text-2xl text-center">You&apos;re all caught up!</Text>
        </View>
    );

    useEffect(() => {
        if (hasData && data.notifications.some(item => item.readAt === null)) {
            console.log("Hit")
            mutation.mutate();
        }   
    }, [data?.notifications, hasData, mutation]);

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <ScrollView
                className="flex-1"
                contentContainerClassName={hasData ? "pb-20 gap-y-3" : "flex-1"}
                stickyHeaderIndices={hasData ? undefined : [0]}
                scrollEnabled={hasData}
            >
                <View className="bg-white">
                    <Header />
                </View>
                {
                    hasData ?
                        <View className="gap-y-8 mt-2">
                            {
                                data.notifications.map((notification, index) => (
                                    <NotificationItem key={notification.id} index={index} {...notification} />
                                ))
                            }
                        </View>
                    :
                        <View className="flex-1 items-center justify-center px-6">
                            {isAllowed ? renderContent() : renderGuard()}
                        </View>
                }
            </ScrollView>
        </SafeAreaView>
    )
};