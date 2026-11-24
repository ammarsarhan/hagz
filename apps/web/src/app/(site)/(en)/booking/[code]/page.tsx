import type { Metadata } from "next";
import { BookingPage, bookingMetadata } from "@/site/booking/booking-page";

export async function generateMetadata(props: PageProps<"/booking/[code]">): Promise<Metadata> {
  return bookingMetadata((await props.params).code, "en");
}

export default async function Page(props: PageProps<"/booking/[code]">) {
  return <BookingPage code={(await props.params).code} locale="en" />;
}
