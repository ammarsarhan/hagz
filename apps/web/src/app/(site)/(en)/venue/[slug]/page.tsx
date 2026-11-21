import type { Metadata } from "next";
import { VenuePage, venueMetadata } from "@/site/venue/venue-page";

export async function generateMetadata(props: PageProps<"/venue/[slug]">): Promise<Metadata> {
  return venueMetadata((await props.params).slug, "en");
}

export default async function Page(props: PageProps<"/venue/[slug]">) {
  return <VenuePage slug={(await props.params).slug} locale="en" />;
}
