import { S3Client } from "@aws-sdk/client-s3";

const config = {
    region: process.env.AWS_REGION!,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
};

export const s3 = {
    default: new S3Client({
        ...config,
        endpoint: process.env.AWS_ENDPOINT_URL!,
    }),
    presign: new S3Client({
        ...config,
        endpoint: 
            process.env.NODE_ENV === "production" ? 
            process.env.AWS_ENDPOINT_URL! : 
            process.env.LOCALSTACK_URL!
    })
};

export const BUCKET = process.env.S3_BUCKET_NAME!;
