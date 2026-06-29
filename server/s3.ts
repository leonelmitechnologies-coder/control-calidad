import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

/**
 * Initialize S3 client for MinIO
 */
const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "us-east-1",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_STORAGE_BUCKET_NAME || "uploads";
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL || "";

/**
 * Generate a unique filename for uploads
 */
function generateFilename(
  originalName: string,
  prefix?: string
): string {
  const ext = originalName.split(".").pop() || "jpg";
  const timestamp = Date.now();
  const random = crypto.randomBytes(3).toString("hex");
  const name = prefix
    ? `${prefix}-${timestamp}-${random}.${ext}`
    : `${timestamp}-${random}.${ext}`;
  return name;
}

/**
 * Upload a file to S3/MinIO
 */
export async function uploadFileToS3(
  fileBuffer: Buffer,
  originalName: string,
  folder: string,
  prefix?: string
): Promise<string> {
  try {
    const filename = generateFilename(originalName, prefix);
    const key = `${folder}/${filename}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: "image/*",
      })
    );

    // Return the public URL
    return `${PUBLIC_URL}/${BUCKET_NAME}/${key}`;
  } catch (error) {
    console.error("[S3] Upload error:", error);
    throw error;
  }
}

/**
 * Upload multiple files to S3/MinIO
 */
export async function uploadFilesToS3(
  files: Array<{ buffer: Buffer; originalname: string }>,
  folder: string,
  prefix?: string
): Promise<string[]> {
  try {
    const urls: string[] = [];

    for (const file of files) {
      const filename = generateFilename(file.originalname, prefix);
      const key = `${folder}/${filename}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: "image/*",
        })
      );

      urls.push(`${PUBLIC_URL}/${BUCKET_NAME}/${key}`);
    }

    return urls;
  } catch (error) {
    console.error("[S3] Batch upload error:", error);
    throw error;
  }
}

/**
 * Delete a file from S3/MinIO
 */
export async function deleteFileFromS3(key: string): Promise<void> {
  try {
    // Extract the key from the full URL if needed
    const actualKey = key.includes("/")
      ? key.split(`/${BUCKET_NAME}/`)[1] || key
      : key;

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: actualKey,
      })
    );
  } catch (error) {
    console.error("[S3] Delete error:", error);
    throw error;
  }
}

/**
 * Get a presigned URL for an object (for downloading/viewing)
 */
export async function getPresignedUrl(
  key: string,
  expirationSeconds: number = 3600
): Promise<string> {
  try {
    const actualKey = key.includes("/")
      ? key.split(`/${BUCKET_NAME}/`)[1] || key
      : key;

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: actualKey,
      }),
      { expiresIn: expirationSeconds }
    );

    return url;
  } catch (error) {
    console.error("[S3] Presigned URL error:", error);
    throw error;
  }
}

/**
 * Extract filename from S3 URL or key
 */
export function extractFilenameFromUrl(url: string): string {
  // If it's a full URL, extract the filename
  if (url.includes("/")) {
    return url.split("/").pop() || url;
  }
  return url;
}

/**
 * Get the S3 key from a stored filename (for deletion, etc.)
 */
export function getS3Key(folder: string, filename: string): string {
  return `${folder}/${filename}`;
}

export default s3Client;
