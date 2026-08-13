import cn from "@/lib/cn";
import { notificationsIconMap } from "@/lib/types/notifications";
import { InAppNotification } from "@/lib/types/user";
import { formatDistanceToNow } from "date-fns";
import { View, Text } from "react-native";

type NotificationItemProps = InAppNotification & { index: number };

export default function NotificationItem({ title, body, event, createdAt, readAt } : NotificationItemProps) {
    const Icon = notificationsIconMap[event];
    const isRead = readAt !== null;

    return (
        <View className={cn(`border-b pb-8 items-center gap-x-7 pl-6 pr-7 flex-row border-gray-100`)}>
            <View className={cn("size-11 rounded-full items-center justify-center bg-gray-100")}>
                <Icon width={20} height={20}/>
            </View>
            <View className="gap-y-2 flex-1">
                <Text className="font-medium text-[1.1rem]">{title}</Text>
                <Text className="mb-2">{body}</Text>
                <Text className="text-gray-500">{formatDistanceToNow(createdAt, { addSuffix: true })}</Text>
            </View>
            <View className={cn("size-2 rounded-full", isRead ? "hidden" : "bg-primary")}></View>
        </View>
    )
}