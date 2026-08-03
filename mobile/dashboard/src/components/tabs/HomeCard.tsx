import { IconCalendarCheck } from "@tabler/icons-react-native";
import { View, Text } from "react-native";

export default function HomeCard() {
    return (
        <View className="p-5 w-[300px] rounded-lg border border-gray-200 gap-y-6">
            <View className="flex-row items-center gap-x-3">
                <View className="items-center justify-center size-8 rounded-lg bg-gray-100">
                    <IconCalendarCheck width={16} height={16}/>
                </View>
                <View>
                    <Text className="font-medium">08:00 - 09:00</Text>
                    <Text className="text-[0.9rem] text-gray-500">Reserved</Text>
                </View>
            </View>
            <View className="gap-y-[3px]">
                <Text className="text-[0.9rem]">+20 106 151 3190</Text>
                <Text className="font-medium text-xl">Ammar Yasser</Text>
                <Text className="text-gray-500 text-sm">On Al Nour Sports Complex - Ground 1</Text>
            </View>
            <View className="flex-row items-center justify-between">
                <View>
                    <Text className="text-sm font-medium">EGP 800.00</Text>
                    <Text className="text-sm">Paid</Text>
                </View>
                <View className="size-8 rounded-full bg-primary/5 items-center justify-center">
                    <Text className="text-sm">A</Text>
                </View>
            </View>
        </View>
    )
}