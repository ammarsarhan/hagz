import * as ImagePicker from 'expo-image-picker';
import { client } from '@/lib/client';
import { ApiError, parseClientError } from '@/lib/error';

const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMimeType = (typeof mimeTypes)[number];

export async function uploadAvatar(asset: ImagePicker.ImagePickerAsset) {
    const mimeType = asset.mimeType || 'image/jpeg';
    const fileSize = asset.fileSize ?? 0;

    if (!isAllowedMimeType(mimeType)) {
        throw new Error('Invalid image type.');
    }

    if (fileSize > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5 MBs.');
    }

    const presignData = await getPresignedUpload(mimeType, fileSize);
    const uploaded = await uploadToStorage(asset.uri, presignData.presign, mimeType);

    if (!uploaded) {
        throw new Error('Failed to upload image to storage provider.');
    }

    return confirmAvatarUpload(presignData.id);
};

function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
    return mimeTypes.includes(mimeType as AllowedMimeType);
};

async function getPresignedUpload(mimeType: AllowedMimeType, size: number) {
    const response = await client.app.profile.avatar.presign.$post({
        json: { contentType: mimeType, size },
    });

    if (!response.ok) {
        const error = await parseClientError(response);
        throw new ApiError(error);
    }

    const { data } = await response.json();
    return data;
};

async function uploadToStorage(uri: string, presignUrl: string, mimeType: string) {
    try {
        const fileResponse = await fetch(uri);
        const blob = await fileResponse.blob();

        const response = await fetch(presignUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: blob,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Storage upload failed:', response.status, errorText);
        }

        return response.ok;
    } catch (e) {
        console.error('Upload failed:', e);
        return false;
    }
};

async function confirmAvatarUpload(avatarId: string) {
    const response = await client.app.profile.avatar[':avatarId'].confirm.$post({
        param: { avatarId: encodeURIComponent(avatarId) },
    });

    if (!response.ok) {
        const error = await parseClientError(response);
        throw new ApiError(error);
    }

    const { data } = await response.json();
    return data.profile;
};
