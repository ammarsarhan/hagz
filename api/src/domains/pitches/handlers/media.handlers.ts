import { createFactory } from "hono/factory";
import MediaService from "@/domains/pitches/services/media.service.js";
import guard from "../pitches.middleware.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";
import { createPitchMediaPresignLinkSchema } from "@/domains/pitches/pitches.validator.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";

const factory = createFactory();
const mediaService = new MediaService();

export const createPitchMediaPresignLinkHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    validate("json", createPitchMediaPresignLinkSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");

        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const { url, id } = await mediaService.generatePitchMediaPresignLink(pitchId, payload);

        return c.json({ success: true, data: { url, id } }, 200); 
    }
);

export const confirmPitchMediaUploadHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const mediaId = c.req.param("mediaId");

        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!mediaId)
            throw new NotFoundError("Could not find media with the specified ID.", ERROR_CODES.PITCH_MEDIA_NOT_FOUND);

        const media = await mediaService.confirmPitchMediaUpload(pitchId, mediaId);
        return c.json({ success: true, data: { media } }, 200); 
    }
);
