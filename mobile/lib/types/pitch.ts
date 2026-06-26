import { InferResponseType } from "hono/client";
import { client } from "@/lib/client";
import { parseCamelCase } from "@/lib/string";

export type PitchFeed = InferResponseType<typeof client.app.pitches.feed.$get, 200>["data"];
export type FeedPitch = PitchFeed["general"][keyof PitchFeed["general"]][number];

export type FeedSection = {label: string; cards: FeedPitch[]};

const entries = <T extends Record<string, FeedPitch[]>>(obj: T) => Object.entries(obj) as [keyof T, FeedPitch[]][];

export const parsePitchFeedResponse = (feed: PitchFeed): FeedSection[] => {
    return [
        ...entries(feed.personalized),
        ...entries(feed.general),
    ]
        .filter(([, items]) => items.length > 0)
        .map(([key, items]) => ({
            label: parseCamelCase(String(key)),
            cards: items,
        }));
};
