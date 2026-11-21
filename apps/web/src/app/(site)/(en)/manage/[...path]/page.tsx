import type { Metadata } from "next";
import { ManagePage, manageMetadata } from "@/site/manage/manage-page";

export async function generateMetadata(props: PageProps<"/manage/[...path]">): Promise<Metadata> {
  return manageMetadata((await props.params).path, "en");
}

export default async function Page(props: PageProps<"/manage/[...path]">) {
  return <ManagePage path={(await props.params).path} locale="en" />;
}
