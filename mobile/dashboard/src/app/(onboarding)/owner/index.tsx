import { useAuth } from "@/context/AuthContext";
import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "@/components/shared/Avatar";
import Button from "@/components/shared/Button";
import { IconBallFootball, IconChevronRight, IconLayoutDashboard, IconPhotoAlt, IconTextCaption } from "@tabler/icons-react-native";

// We have 3 cases:
// Either that the owner does not have any pitches at all yet.
// Or they have a draft in the works.
// Or they have already submitted a venue to be reviewed.

export default function Index() {
    const { user } = useAuth();

    if (!user) {
        router.push("/(auth)/sign-in");
        return;
    };

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1">
            <SafeAreaView className="p-6 flex-1 gap-y-10">
                <View className="gap-y-3">
                    <View className="mb-2">
                        <Pressable onPress={() => router.push("/(onboarding)/owner/(modal)")}>
                            <Avatar />
                        </Pressable>
                    </View>
                    <Text className="text-4xl font-semibold">Create your first pitch</Text> 
                    <Text className="text-gray-500">You do not have any pitches yet. Let&apos;s get started by creating your first pitch.</Text> 
                </View>
                <View className="gap-y-4 flex-1 w-full">
                    <View className="p-5 flex-row items-center gap-x-4 rounded-lg bg-white border border-gray-100">
                        <IconTextCaption color={"#000"} width={24} height={24}/>
                        <View className="flex-1">
                            <Text className="font-semibold">Details</Text>
                            <Text className="text-sm text-gray-500">Add basic information about your pitch.</Text>
                        </View>
                        <View>
                            <IconChevronRight width={20} height={20} color="#9CA3AF"/>
                        </View>
                    </View>
                    <View className="p-5 flex-row items-center gap-x-4 rounded-lg bg-gray-50">
                        <IconPhotoAlt color={"#9CA3AF"} width={24} height={24}/>
                        <View className="flex-1">
                            <Text className="font-medium text-gray-400">Media & Images</Text>
                            <Text className="text-sm text-gray-400">Take pictures of your pitch, grounds, and amenities to show users.</Text>
                        </View>
                    </View>
                    <View className="p-5 flex-row items-center gap-x-4 rounded-lg bg-gray-50">
                        <IconBallFootball color={"#9CA3AF"} width={24} height={24}/>
                        <View className="flex-1">
                            <Text className="font-medium text-gray-400">Amenities</Text>
                            <Text className="text-sm text-gray-400">Select amenities and how your venue prices them.</Text>
                        </View>
                    </View>
                    <View className="p-5 flex-row items-center gap-x-4 rounded-lg bg-gray-50">
                        <IconLayoutDashboard color={"#9CA3AF"} width={24} height={24}/>
                        <View className="flex-1">
                            <Text className="font-medium text-gray-400">Grounds</Text>
                            <Text className="text-sm text-gray-400">Create grounds and specify their settings & schedule.</Text>
                        </View>
                    </View>
                </View>
                <Link asChild href="/(onboarding)/owner/details">
                    <Button className="bg-primary border-primary">
                        <Text className="text-white font-medium">Get Started</Text>
                    </Button>
                </Link>
            </SafeAreaView>
        </Animated.View>
    )
}