import z from "zod";

import { uploadRequestSchema } from "@/domains/upload/upload.validator";
import { v4 as uuidv4 } from "uuid";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@/shared/lib/s3";

export default class UploadService {
    getPresignData = async (data: z.infer<typeof uploadRequestSchema>) => {
        const { fileName, contentType } = data;
        const extension = fileName.split('.').pop();
        const key = `${uuidv4()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
            ChecksumAlgorithm: undefined
        });

        const rawUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
        const urlObject = new URL(rawUrl);

        urlObject.searchParams.delete("x-amz-checksum-crc32");
        urlObject.searchParams.delete("x-amz-sdk-checksum-algorithm");

        const url = urlObject.toString().replace(process.env.S3_ENDPOINT_URL!, process.env.AWS_ENDPOINT_URL!);
        
        return { url, key };
    };

    deleteObject = async (key: string) => {        
        const command = new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: key
        });

        const result = await s3.send(command);
        return result;
    }
}