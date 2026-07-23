import * as ImagePicker from "expo-image-picker";
import { PitchMediaPresignPayload, PitchMediaResponse } from "@/lib/types/pitch";

export type RemotePitchMedia = PitchMediaResponse["data"]["media"][number];

export type LocalMediaBase = {
    localId: string;
    order: number;
    contentType: PitchMediaPresignPayload["contentType"];
    previewUrl: string;
    asset: ImagePicker.ImagePickerAsset;
};

export type Media =
    | (RemotePitchMedia & { state: "UPLOADED" })
    | (LocalMediaBase & { state: "UPLOADING"; progress: number })
    | (LocalMediaBase & { state: "ERROR"; error: string });
    