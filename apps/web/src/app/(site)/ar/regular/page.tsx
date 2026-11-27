import type { Metadata } from "next";
import { RegularPage } from "@/site/regular/regular-page";
import { wordsFor } from "@/site/words";

export const metadata: Metadata = {
  title: wordsFor("ar").regular.meta,
  // One customer's week, behind a token: kept out of search engines.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RegularPage locale="ar" />;
}
