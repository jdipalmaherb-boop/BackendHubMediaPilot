import { S3Client } from '@aws-sdk/client-s3';

export function createS3Client() {
  const region = process.env.S3_REGION || 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
  const accessKeyId = process.env.S3_ACCESS_KEY || 'minioadmin';
  const secretAccessKey = process.env.S3_SECRET_KEY || 'minioadmin';

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}





