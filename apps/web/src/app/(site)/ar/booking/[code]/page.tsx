import type { Metadata } from "next";
import { BookingPage, bookingMetadata } from "@/site/booking/booking-page";

export async function generateMetadata(props: PageProps<"/ar/booking/[code]">): Promise<Metadata> {
  return bookingMetadata((await props.params).code, "ar");
}

export default async function Page(props: PageProps<"/ar/booking/[code]">) {
  return <BookingPage code={(await props.params).code} locale="ar" />;
}
