import {
    IconCalendarEvent,
    IconCalendarCheck,
    IconCalendarX,
    IconCalendarRepeat,
    IconBell,
    IconPlayerPlay,
    IconClockX,
    IconUserX,
    IconCalendarPlus,
    IconEdit,
    IconCash,
    IconCashOff,
    IconMail,
    IconMailOpened,
    IconUserCheck,
    IconMapPinExclamation,
} from "@tabler/icons-react-native";
import { InAppNotification } from "@/lib/types/user";

export const notificationsIconMap: Record<
    InAppNotification['event'],
    React.ComponentType<any>
> = {
    // Customer-facing
    BOOKING_RESERVED: IconCalendarEvent,
    BOOKING_CONFIRMED: IconCalendarCheck,
    BOOKING_CANCELLED: IconCalendarX,
    BOOKING_RESCHEDULED: IconCalendarRepeat,
    BOOKING_REMINDER: IconBell,
    BOOKING_STARTED: IconPlayerPlay,
    BOOKING_EXPIRED: IconClockX,
    BOOKING_NO_SHOW: IconUserX,

    // Staff-facing
    BOOKING_RECEIVED: IconCalendarPlus,
    BOOKING_UPDATED: IconEdit,
    PAYOUT_PROCESSED: IconCash,
    PAYOUT_FAILED: IconCashOff,
    INVITATION_CREATED: IconMail,
    INVITATION_RECEIVED: IconMailOpened,
    INVITATION_ACCEPTED: IconUserCheck,
    PITCH_UPDATED: IconMapPinExclamation,
};