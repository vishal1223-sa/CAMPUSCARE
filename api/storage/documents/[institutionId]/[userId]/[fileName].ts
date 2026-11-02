import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.resolve('/tmp', 'campuscare-uploads');

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { institutionId, userId, fileName } = req.query || {};
    const safeInstId = String(institutionId || 'inst-main').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeUserId = String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = path.basename(String(fileName || '')).replace(/[^a-zA-Z0-9_.-]/g, '_');

    const filePath = path.join(UPLOADS_DIR, 'institutions', safeInstId, 'users', safeUserId, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const ext = path.extname(safeFileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.webp': 'image/webp',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  } catch (err) {
    return res.status(500).json({ error: 'Error retrieving document' });
  }
}
