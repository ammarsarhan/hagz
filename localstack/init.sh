#!/bin/bash
echo "Configuring LocalStack S3..."

# 1. Create the bucket
awslocal s3 mb s3://hagz

# 2. Set the CORS configuration
awslocal s3api put-bucket-cors --bucket hagz --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-request-id", "x-amz-id-2"]
    }
  ]
}'

echo "S3 bucket 'hagz' created with CORS policy applied."