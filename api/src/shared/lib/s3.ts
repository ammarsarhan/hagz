import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    endpoint: process.env.S3_ENDPOINT_URL!,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
});
