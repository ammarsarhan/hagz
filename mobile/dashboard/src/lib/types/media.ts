import { PitchMediaPresignPayload, PitchMediaResponse } from "@/lib/types/pitch";

export type RemotePitchMedia = PitchMediaResponse["data"]["media"][number];

export type LocalMediaBase = {
    localId: string;
    order: number;
    contentType: PitchMediaPresignPayload["contentType"];
    previewUrl: string;
};

export type Media =
    | (RemotePitchMedia & { state: "UPLOADED" }) // Hydrated from the server or uploaded.
    | (LocalMediaBase & { state: "UPLOADING"; file: File; progress: number }) // Local still uploading.
    | (LocalMediaBase & { state: "ERROR"; file: File; error: string }); // Local but failed to upload.
    