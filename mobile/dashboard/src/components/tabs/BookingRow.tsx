import { BookingRowData } from "@/lib/types/bookings";
import { addHours, formatDate } from "date-fns";
import { Image } from "expo-image";
import { View, Text } from "react-native";

type BookingRowProps = BookingRowData;
type BookingType = NonNullable<BookingRowData['bookings'][number]['booking']>;

const StatusPill = ({ status }: { status: BookingType['status'] }) => {
    const label = `${status[0].toUpperCase()}${status.slice(1).toLowerCase()}`;

    return (
        <View className="border border-gray-200 bg-white px-4 py-2 rounded-full">
            <Text className="text-sm">{label}</Text>
        </View>
    );
};

export default function BookingRow({ hour, bookings }: BookingRowProps) {
    return (
        <View className="gap-y-4">
            <Text>{formatDate(hour, "hh:mm a")} to {formatDate(addHours(hour, 1), "hh:mm a")}</Text>
            {
                bookings.map(item => {
                    const booking = item.booking!;

                    return (
                        <View key={item.id} className="bg-gray-50 p-6 rounded-lg gap-y-1">
                            <Text className="font-medium">{booking.customer.firstName} {booking.customer.lastName}</Text>
                            <Text>{item.ground.name}</Text>
                            <View className="mt-4 flex-row items-center justify-between">
                                <StatusPill status={booking.status} />
                                <View className="size-9 rounded-full bg-primary/10 items-center justify-center overflow-hidden">
                                    {
                                        booking.initiator.avatarUrl ?
                                        <Image
                                            source={{ uri: booking.initiator.avatarUrl }}
                                            style={{ width: 36, height: 36 }}
                                            contentFit="cover"
                                        /> :
                                        <Text className="text-sm">{booking.initiator.firstName[0].toUpperCase()}</Text>
                                    }
                                </View>
                            </View>
                        </View>
                    );
                })
            }
        </View>
    );
};
