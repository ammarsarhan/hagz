import z from "zod";

export const uploadRequestSchema = z.object({
    fileName: z.string(),
    contentType: z.string(),
    size: z.number()
});
