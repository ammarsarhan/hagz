import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { client } from "@/lib/client";
import { ApiError, parseClientError } from "@/lib/error";
import { PitchMediaPresignPayload } from "@/lib/types/pitch";

const mimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMimeType = (typeof mimeTypes)[number];

function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
    return mimeTypes.includes(mimeType as AllowedMimeType);
}

export async function uploadPitchMedia(
    pitchId: string,
    asset: ImagePicker.ImagePickerAsset,
    onProgress: (fraction: number) => void
) {
    const mimeType = asset.mimeType || "image/jpeg";
    const fileSize = asset.fileSize ?? 0;

    if (!isAllowedMimeType(mimeType)) {
        throw new Error("Invalid image type.");
    }
    if (fileSize > 5 * 1024 * 1024) {
        throw new Error("Image must be less than 5 MBs.");
    }

    const presignData = await getPresignedUpload(pitchId, mimeType, fileSize);
    const uploaded = await uploadToStorage(asset.uri, presignData.presign, mimeType);

    if (!uploaded) {
        throw new Error("Failed to upload image to storage provider.");
    }

    return confirmPitchMediaUpload(pitchId, presignData.id);
};

export const deletePitchMedia = async (pitchId: string, mediaId: string) => {
    const res = await client.dashboard.pitches[':pitchId'].media[':mediaId'].$delete({ param: { pitchId, mediaId }});
    const { success } = await res.json();
    return success;
};

async function getPresignedUpload(pitchId: string, mimeType: AllowedMimeType, size: number) {
    const response = await client.dashboard.pitches[":pitchId"].media.presign.$post({
        param: { pitchId },
        json: { contentType: mimeType, size } satisfies PitchMediaPresignPayload,
    });

    if (!response.ok) {
        const error = await parseClientError(response);
        throw new ApiError(error);
    }

    const { data } = await response.json();
    return data;
}

async function uploadToStorage(uri: string, presignUrl: string, mimeType: string) {
    try {
        const result = await FileSystem.uploadAsync(presignUrl, uri, {
            httpMethod: "PUT",
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: { "Content-Type": mimeType },
        });

        return result.status >= 200 && result.status < 300;
    } catch (e) {
        console.error("Upload failed:", e);
        return false;
    }
}

async function confirmPitchMediaUpload(pitchId: string, mediaId: string) {
    const response = await client.dashboard.pitches[":pitchId"].media[":mediaId"].confirm.$post({
        param: { pitchId, mediaId: encodeURIComponent(mediaId) },
    });

    if (!response.ok) {
        const error = await parseClientError(response);
        throw new ApiError(error);
    }

    const { data } = await response.json();
    return data;
}
