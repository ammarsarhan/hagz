#!/bin/bash
echo ">>> Creating S3 bucket..."

awslocal s3 mb s3://${S3_BUCKET_NAME:-hagz}

awslocal s3api put-bucket-cors \
  --bucket ${S3_BUCKET_NAME:-hagz} \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedOrigins": ["http://localhost:3000"],
      "AllowedMethods": ["PUT", "GET", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"]
    }]
  }'

echo ">>> LocalStack S3 ready!"