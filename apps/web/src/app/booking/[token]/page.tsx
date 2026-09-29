import type { Metadata } from "next";

type Props = { params: Promise<{ token: string }> };

// Server-rendered so link previews (WhatsApp, iMessage) get real Open Graph tags.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return { title: "Booking on Hagz", openGraph: { title: "Booking on Hagz" } };
}

export default async function SharedBooking({ params }: Props) {
  const { token } = await params;

  return (
    <main>
      <h1>Booking</h1>
      <p>{token}</p>
    </main>
  );
}
