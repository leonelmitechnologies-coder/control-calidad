import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";

// Use local disk when S3 credentials are not configured
const USE_LOCAL = !process.env.AWS_ENDPOINT_URL_S3 || !process.env.AWS_ACCESS_KEY_ID;
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Initialize S3 client for MinIO
 */
const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "us-east-1",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: true, // required for MinIO
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
 * Upload a file to S3/MinIO, or local disk if S3 is not configured.
 */
export async function uploadFileToS3(
  fileBuffer: Buffer,
  originalName: string,
  folder: string,
  prefix?: string
): Promise<string> {
  const filename = generateFilename(originalName, prefix);

  if (USE_LOCAL) {
    const dir = path.join(LOCAL_UPLOADS_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), fileBuffer);
    return `/uploads/${folder}/${filename}`;
  }

  try {
    const key = `${folder}/${filename}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: "image/*",
      })
    );
    return `${PUBLIC_URL}/${BUCKET_NAME}/${key}`;
  } catch (error) {
    console.error("[S3] Upload failed, falling back to local disk:", (error as Error).message);
    const dir = path.join(LOCAL_UPLOADS_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), fileBuffer);
    return `/uploads/${folder}/${filename}`;
  }
}

/**
 * Upload to S3 only — throws on failure (no local fallback).
 * Used when the caller handles the fallback itself (e.g., DB storage).
 */
export async function uploadToS3Only(
  fileBuffer: Buffer,
  originalName: string,
  folder: string,
  prefix?: string
): Promise<string> {
  if (USE_LOCAL) throw new Error("S3 not configured");

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
  return `${PUBLIC_URL}/${BUCKET_NAME}/${key}`;
}

/**
 * Upload multiple files to S3/MinIO, or local disk if S3 is not configured.
 */
export async function uploadFilesToS3(
  files: Array<{ buffer: Buffer; originalname: string }>,
  folder: string,
  prefix?: string
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    const url = await uploadFileToS3(file.buffer, file.originalname, folder, prefix);
    urls.push(url);
  }

  return urls;
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
 * Build a public URL for a stored file (works for both local and S3).
 */
export function getFileUrl(folder: string, filename: string): string {
  if (USE_LOCAL) {
    return `/uploads/${folder}/${filename}`;
  }
  return `${PUBLIC_URL}/${BUCKET_NAME}/${folder}/${filename}`;
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
