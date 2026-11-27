import { Platform } from "react-native";
import { createEventInCalendarAsync, requestCalendarPermissionsAsync } from "expo-calendar/legacy";

// Add to calendar: the phone's own "new event" form, filled in, so the player sees the event and
// picks the calendar before anything is saved. The app never reads the calendar.
//
// iOS 17+ shows the form out of the app's process and needs no permission at all; iOS 16 needs
// calendar access first (asked here; iOS 16 has no write-only access). Android opens the
// calendar app with an intent, no permission either, and can't say whether it was saved.

export type CalendarEvent = {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  notes?: string;
  url?: string;
};

export type CalendarResult = "saved" | "done" | "canceled" | "denied";

export async function addToCalendar(event: CalendarEvent): Promise<CalendarResult> {
  if (Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) < 17) {
    const permission = await requestCalendarPermissionsAsync();
    if (!permission.granted) return "denied";
  }
  const result = await createEventInCalendarAsync({
    title: event.title,
    startDate: new Date(event.startsAt),
    endDate: new Date(event.endsAt),
    location: event.location,
    notes: event.notes,
    url: event.url,
  });
  return result.action === "saved" || result.action === "done" ? result.action : "canceled";
}
