import { StatusBar, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconLayoutDashboard, IconUsersGroup, IconWorldDollar } from "@tabler/icons-react-native";

import Icon from "@/assets/base/cropped.svg";
import Button from "@/components/shared/Button";
import { Link } from "expo-router";

export default function Index() {
    return (
        <>
            <StatusBar barStyle={"light-content"} />
            <View className="flex-1 bg-black">
                <SafeAreaView className="flex-1 p-6">
                    <View className="flex-row items-center gap-x-2">
                        <Icon width={30} height={30} color={"#FFF"}/>
                        <Text className="text-white font-semibold">Dashboard</Text>
                    </View>
                    <View className="flex-1 items-center justify-center">
                        <View className="gap-y-6 w-full">
                            <Text className="text-4xl font-semibold text-white w-full">Manage all of your bookings seamlessly!</Text>
                            <View className="gap-y-4 w-full">
                                <View className="flex-row items-center gap-x-4">
                                    <IconLayoutDashboard color={"#FFF"} width={22} height={22}/>
                                    <Text className="text-white flex-1">
                                        Accept and handle bookings on all of your venues, instantly.
                                    </Text>
                                </View>
                                <View className="flex-row items-center gap-x-4">
                                    <IconWorldDollar color={"#FFF"} width={22} height={22}/>
                                    <Text className="text-white flex-1">
                                        Guarantee cash, wallet, and credit card deposits from players on the dot.
                                    </Text>
                                </View>
                                <View className="flex-row items-center gap-x-4">
                                    <IconUsersGroup color={"#FFF"} width={22} height={22}/>
                                    <Text className="text-white flex-1">
                                        Add managers to your venue to help you organize bookings.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className="gap-y-3">
                        <Link asChild href="/(auth)/sign-up"> 
                            <Button className="bg-primary border-primary">
                                <Text className="text-white font-medium">Create Account</Text>
                            </Button>
                        </Link>
                        <Link asChild href="/(auth)/sign-in">
                            <Button className="border-white/25">
                                <Text className="text-white font-medium">Sign In</Text>
                            </Button>
                        </Link>
                    </View>
                </SafeAreaView>
            </View>
        </>
    )
}