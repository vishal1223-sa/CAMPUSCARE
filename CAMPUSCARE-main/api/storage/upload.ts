import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

// Memory/tmp store for serverless environments (like Vercel)
const UPLOADS_DIR = path.resolve('/tmp', 'campuscare-uploads');

export default async function handler(req: any, res: any) {
  // CORS Handling
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { userId, institutionId = 'inst-main', fileName, contentType = 'image/webp', base64Data } = body || {};

    if (!userId || !fileName || !base64Data) {
      return res.status(400).json({ error: 'Missing required upload parameters (userId, fileName, base64Data).' });
    }

    const safeInstId = String(institutionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_');

    const targetDir = path.join(UPLOADS_DIR, 'institutions', safeInstId, 'users', safeUserId);
    await fs.promises.mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, safeFileName);
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(filePath, buffer);

    const storagePath = `institutions/${safeInstId}/users/${safeUserId}/${safeFileName}`;
    const host = req.headers?.host || '';
    const protocol = req.headers?.['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const baseUrl = host ? `${protocol}://${host}` : '';
    const downloadUrl = `${baseUrl}/api/storage/documents/${safeInstId}/${safeUserId}/${safeFileName}`;

    return res.status(200).json({
      success: true,
      downloadUrl,
      storagePath,
      size: buffer.length,
      contentType,
      uploadedAt: new Date().toISOString()
    });
  } catch (err: unknown) {
    console.error('Serverless storage upload error:', err);
    return res.status(500).json({
      error: 'Failed to process document upload on serverless runtime',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}
