import prisma from "@/shared/lib/utils/prisma.js";
import type { CreatePitchMediaPresignLinkPayloadType } from "../pitches.validator.js";
import { MediaStatus, MediaType, PitchStatus } from "@/generated/prisma/enums.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import config from "@/shared/config.js";
import { randomUUID } from "crypto";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET, s3 } from "@/shared/lib/utils/s3.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default class MediaService {
    generatePitchMediaPresignLink = async (pitchId: string, payload: CreatePitchMediaPresignLinkPayloadType) => {
        // Find the pitch and make sure it is in an editable state.
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                amenities: true
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Extract the file extension and generate the key.
        const extension = payload.contentType.split("/")[1];
        const key = `uploads/${randomUUID()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: payload.contentType
        });

        const url = await getSignedUrl(
            s3.presign,
            command,
            { expiresIn: 300 }
        );

        // Generate the record in the database to store the media.
        const media = await prisma.pitchMedia.create({
            data: {
                pitchId,
                key,
                url,
                type: MediaType.IMAGE,
                contentType: payload.contentType,
            }
        })

        return { url, id: media.id };
    };

    confirmPitchMediaUpload = async (pitchId: string, mediaId: string) => {
        // Fetch the media and make sure that it is both pending and that the pitch is not deleted.
        const media = await prisma.pitchMedia.findUnique({
            where: { 
                id: mediaId, 
                status: MediaStatus.PENDING,
                pitch: {
                    id: pitchId,
                    status: { not: PitchStatus.DELETED }
                }
            }
        });

        if (!media) throw new NotFoundError("Could not find pending media upload with the specified ID.", ERROR_CODES.PITCH_MEDIA_NOT_FOUND);

        // Create the command sent to s3 to fetch the object data.
        const command = new HeadObjectCommand({ Bucket: BUCKET, Key: media.key });
        
        // If that object can not be found then the upload has failed or can not be verified.
        try {
            await s3.default.send(command);
        } catch {
            throw new BadRequestError("Upload could not be verified. Please try uploading again.", ERROR_CODES.PITCH_MEDIA_CONFIRMATION_FAILED);
        };

        // Update the media to confirm that it is uploaded and active.
        const updated = await prisma.pitchMedia.update({
            where: { id: mediaId },
            data: { status: MediaStatus.UPLOADED }
        });

        return updated;
    };
};
