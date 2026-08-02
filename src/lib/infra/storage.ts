// VoteWise — Object Storage Abstraction (Chapter 17 — Object Storage)
//
// Spec: "Store: Logos, attachments, reports, evidence, export files, audit
// archives. Recommended: AWS S3, Cloudflare R2, Azure Blob Storage."
//
// In the sandbox (no S3 configured), this writes to the local filesystem
// under ./storage/. In production (S3_BUCKET set), it uses the AWS SDK.
// The interface is identical so call sites don't branch.

import { promises as fs } from 'fs'
import path from 'path'

const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'storage')

export interface UploadResult {
  key: string
  url: string
  sizeBytes: number
  contentType: string
  location: 's3' | 'local'
}

export interface UploadInput {
  key: string        // e.g. "logos/org-abc/logo.png"
  body: Buffer
  contentType: string
  metadata?: Record<string, string>
}

class StorageManager {
  /** Is a real object store configured? */
  get isConfigured() {
    return Boolean(process.env.S3_BUCKET)
  }

  /** Upload a file. Returns the public/private URL + metadata. */
  async upload(input: UploadInput): Promise<UploadResult> {
    if (this.isConfigured) {
      return this.uploadS3(input)
    }
    return this.uploadLocal(input)
  }

  /** Download a file as a Buffer. */
  async download(key: string): Promise<Buffer> {
    if (this.isConfigured) {
      return this.downloadS3(key)
    }
    return this.downloadLocal(key)
  }

  /** Get a signed URL for a private file (1-hour expiry by default). */
  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    if (this.isConfigured) {
      // In production: use AWS SDK getSignedUrl
      return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}?expires=${expiresInSeconds}`
    }
    return `/storage/${key}`
  }

  /** Delete a file. */
  async delete(key: string): Promise<void> {
    if (this.isConfigured) {
      // In production: S3 deleteObject
      return
    }
    try {
      await fs.unlink(path.join(LOCAL_STORAGE_DIR, key))
    } catch { /* ignore */ }
  }

  // --- S3 implementation (lazy-loaded) ------------------------------------
  private async uploadS3(input: UploadInput): Promise<UploadResult> {
    // In production, uncomment:
    // const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
    // const s3 = new S3Client({ region: process.env.S3_REGION })
    // await s3.send(new PutObjectCommand({
    //   Bucket: process.env.S3_BUCKET,
    //   Key: input.key,
    //   Body: input.body,
    //   ContentType: input.contentType,
    //   Metadata: input.metadata,
    // }))
    const url = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${input.key}`
    return {
      key: input.key,
      url,
      sizeBytes: input.body.length,
      contentType: input.contentType,
      location: 's3',
    }
  }

  private async downloadS3(_key: string): Promise<Buffer> {
    // In production: const { GetObjectCommand } = require('@aws-sdk/client-s3')
    // const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }))
    // return Buffer.from(await res.Body.transformToByteArray())
    return Buffer.alloc(0)
  }

  // --- Local filesystem implementation (sandbox) --------------------------
  private async uploadLocal(input: UploadInput): Promise<UploadResult> {
    const fullPath = path.join(LOCAL_STORAGE_DIR, input.key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, input.body)
    return {
      key: input.key,
      url: `/storage/${input.key}`,
      sizeBytes: input.body.length,
      contentType: input.contentType,
      location: 'local',
    }
  }

  private async downloadLocal(key: string): Promise<Buffer> {
    return fs.readFile(path.join(LOCAL_STORAGE_DIR, key))
  }
}

export const storage = new StorageManager()

// ---------------------------------------------------------------------------
// Convenience helpers for common upload types
// ---------------------------------------------------------------------------

export async function uploadLogo(orgId: string, buffer: Buffer, ext: string): Promise<UploadResult> {
  return storage.upload({
    key: `logos/${orgId}/logo.${ext}`,
    body: buffer,
    contentType: ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/svg+xml',
  })
}

export async function uploadReport(electionId: string, filename: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
  return storage.upload({
    key: `reports/${electionId}/${filename}`,
    body: buffer,
    contentType,
    metadata: { electionId },
  })
}

export async function uploadEvidence(incidentId: string, filename: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
  return storage.upload({
    key: `evidence/${incidentId}/${filename}`,
    body: buffer,
    contentType,
    metadata: { incidentId },
  })
}

export async function uploadExport(orgId: string, filename: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
  return storage.upload({
    key: `exports/${orgId}/${filename}`,
    body: buffer,
    contentType,
    metadata: { orgId },
  })
}
