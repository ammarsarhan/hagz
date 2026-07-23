import prisma from "@/shared/lib/utils/prisma.js";
import type { CreatePitchMediaPresignLinkPayloadType } from "../pitches.validator.js";
import { MediaStatus, MediaType, PitchStatus } from "@/generated/prisma/enums.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import config from "@/shared/config.js";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET, s3 } from "@/shared/lib/utils/s3.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default class MediaService {
    generatePitchMediaPresignLink = async (pitchId: string, payload: CreatePitchMediaPresignLinkPayloadType) => {
        const pitch = await prisma.pitch.findFirst({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                media: {
                    where: { status: { not: MediaStatus.DELETED } }
                }
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept media edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_EDITABLE);

        // Enforce a maximum number of media items per pitch.
        if (pitch.media.length >= config.MAXIMUM_MEDIA_PER_PITCH)
            throw new BadRequestError(`You may not upload more than ${config.MAXIMUM_MEDIA_PER_PITCH} media items per pitch.`, ERROR_CODES.PITCH_MEDIA_LIMIT_EXCEEDED);

        const extension = payload.contentType.split("/")[1];
        const key = `pitches/${pitchId}/${randomUUID()}.${extension}`;

        // Permanent public read URL stored in the DB.
        const url = process.env.NODE_ENV === "production" ? `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`: `${process.env.LOCALSTACK_URL}/${BUCKET}/${key}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: payload.contentType,
            ContentLength: payload.size
        });

        // Temporary presigned URL returned to the client for uploading.
        const presign = await getSignedUrl(s3.presign, command, { expiresIn: 300 });

        const media = await prisma.$transaction(async (tx) => {
            const last = await tx.pitchMedia.aggregate({
                where: { pitchId },
                _max: { order: true }
            });

            return tx.pitchMedia.create({
                data: {
                    pitchId,
                    key,
                    url,
                    type: payload.contentType.startsWith("video/") ? MediaType.VIDEO : MediaType.IMAGE,
                    contentType: payload.contentType,
                    status: MediaStatus.PENDING,
                    order: (last._max.order ?? -1) + 1
                }
            });
        }, { isolationLevel: "Serializable" });

        return { presign, id: media.id };
    };

    confirmPitchMediaUpload = async (pitchId: string, mediaId: string) => {
        const media = await prisma.pitchMedia.findFirst({
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

        // Verify the object actually exists in S3 before confirming.
        try {
            await s3.default.send(new HeadObjectCommand({ Bucket: BUCKET, Key: media.key }));
        } catch {
            // Clean up the dangling DB record if the upload never made it to S3.
            await prisma.pitchMedia.delete({ where: { id: mediaId } });
            throw new BadRequestError("Upload could not be verified. Please try uploading again.", ERROR_CODES.PITCH_MEDIA_CONFIRMATION_FAILED);
        };

        const updated = await prisma.pitchMedia.update({
            where: { id: mediaId },
            data: { status: MediaStatus.UPLOADED }
        });

        return updated;
    };

    deletePitchMedia = async (pitchId: string, mediaId: string) => {
        const [media, pitch] = await Promise.all([
            prisma.pitchMedia.findFirst({
                where: {
                    id: mediaId,
                    pitchId,
                    status: { not: MediaStatus.DELETED }
                }
            }),
            prisma.pitch.findUnique({ 
                where: { id: pitchId },
                select: { 
                    status: true,
                    media: {
                        where: { status: MediaStatus.UPLOADED }
                    }
                }
            })
        ]);

        if (!media) throw new NotFoundError("Could not find media with the specified ID.", ERROR_CODES.PITCH_MEDIA_NOT_FOUND);

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept media edits right now.", ERROR_CODES.PITCH_NOT_EDITABLE);

        if (pitch.status === PitchStatus.LIVE && pitch.media.length <= 3)
            throw new BadRequestError("Could not delete media. A live pitch must have at least 3 images.", ERROR_CODES.PITCH_MEDIA_MINIMUM_REQUIRED);

        // Delete from S3 first, then mark as deleted in the DB.
        try {
            await s3.default.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: media.key }));
        } catch {
            // Log but don't block — the DB record should still be marked deleted
            // so it stops being served, even if S3 cleanup fails.
            console.error(`Failed to delete S3 object for media ${mediaId} with key ${media.key}`);
        };

        await prisma.pitchMedia.update({
            where: { id: mediaId },
            data: { status: MediaStatus.DELETED }
        });
    };

    fetchPitchMedia = async (pitchId: string) => {
        const pitch = await prisma.pitch.findFirst({
            where: { id: pitchId, status: { not: PitchStatus.DELETED } }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const media = await prisma.pitchMedia.findMany({
            where: {
                pitchId,
                status: MediaStatus.UPLOADED
            },
            orderBy: { order: "asc" }
        });

        return media;
    };
};
