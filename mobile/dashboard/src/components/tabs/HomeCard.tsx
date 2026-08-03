import { IconCalendarCheck, IconCalendarClock } from "@tabler/icons-react-native";
import { View, Text } from "react-native";
import { format } from "date-fns";
import { formatPhone } from "@/lib/string";

type HomeCardProps = {
    startTime: string | Date;
    endTime: string | Date;
    groundName: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    isApproved: boolean;
    isPaid: boolean;
};

export default function HomeCard({
    startTime,
    endTime,
    groundName,
    customerName,
    customerPhone,
    totalAmount,
    isApproved,
    isPaid,
}: HomeCardProps) {
    const timeRange = `${format(new Date(startTime), "HH:mm")} - ${format(new Date(endTime), "HH:mm")}`;

    const subtitle = !isApproved
        ? "Awaiting Approval"
        : !isPaid
        ? "Reserved"
        : "Confirmed";

    const paymentLabel = !isPaid ? "Awaiting Payment" : "Paid";

    return (
        <View className="p-5 w-[300px] rounded-lg border border-gray-200 gap-y-6">
            <View className="flex-row items-center gap-x-3">
                <View className="items-center justify-center size-8 rounded-lg bg-gray-100">
                    {
                        isPaid ? 
                        <IconCalendarCheck width={16} height={16}/> :
                        <IconCalendarClock width={16} height={16}/>
                    }
                </View>
                <View>
                    <Text className="font-medium">{timeRange}</Text>
                    <Text className="text-[0.9rem] text-gray-500">{subtitle}</Text>
                </View>
            </View>
            <View className="gap-y-1">
                <Text>{formatPhone(customerPhone)}</Text>
                <Text className="font-medium text-2xl">{customerName}</Text>
                <Text className="text-gray-500 text-sm">{groundName}</Text>
            </View>
            <View className="flex-row items-center justify-between">
                <View className="gap-y-0.5">
                    <Text className="text-[0.925rem] font-medium">EGP {totalAmount.toFixed(2)}</Text>
                    <Text className="text-[0.925rem]">{paymentLabel}</Text>
                </View>
                <View className="size-9 rounded-full bg-primary/5 items-center justify-center">
                    <Text className="text-[0.925rem] font-medium">{customerName.charAt(0).toUpperCase()}</Text>
                </View>
            </View>
        </View>
    )
}