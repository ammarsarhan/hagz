import { InferResponseType } from "hono/client";
import { client } from "@/lib/client";
import { parseCamelCase } from "@/lib/string";

export type PitchFeed = InferResponseType<typeof client.app.pitches.feed.$get, 200>["data"];
type FeedSectionResponse = PitchFeed["general"][keyof PitchFeed["general"]];

export type FeedPitch = FeedSectionResponse["cards"][number];

export type FeedSection = {
    label: string;
    description: string | null;
    cards: FeedPitch[];
};

const entries = <T extends Record<string, { description: string | null; cards: FeedPitch[] }>>(obj: T) => Object.entries(obj) as [keyof T, T[keyof T]][];

export const parsePitchFeedResponse = (feed: PitchFeed): FeedSection[] => {
    return [
        ...entries(feed.personalized),
        ...entries(feed.general),
    ]
        .filter(([, section]) => section.cards.length > 0)
        .map(([key, section]) => ({
            label: parseCamelCase(String(key)),
            description: section.description,
            cards: section.cards,
        }));
};
