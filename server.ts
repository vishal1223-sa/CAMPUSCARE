import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable JSON body parsing with adequate limit for compressed image uploads
app.use(express.json({ limit: '25mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusCare API',
    architecture: 'Multi-Institution ID-Card Verification',
    timestamp: new Date().toISOString()
  });
});

// Storage upload directory
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

// Endpoint: Upload verification document
app.post('/api/storage/upload', async (req, res) => {
  try {
    const { userId, institutionId = 'inst-main', fileName, contentType = 'image/webp', base64Data } = req.body;

    if (!userId || !fileName || !base64Data) {
      return res.status(400).json({ error: 'Missing required upload parameters (userId, fileName, base64Data).' });
    }

    // Sanitize path inputs to prevent directory traversal
    const safeInstId = String(institutionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_');

    const targetDir = path.join(UPLOADS_DIR, 'institutions', safeInstId, 'users', safeUserId);
    await fs.promises.mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, safeFileName);
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(filePath, buffer);

    const storagePath = `institutions/${safeInstId}/users/${safeUserId}/${safeFileName}`;
    const downloadUrl = `/api/storage/documents/${safeInstId}/${safeUserId}/${safeFileName}`;

    return res.status(200).json({
      success: true,
      downloadUrl,
      storagePath,
      size: buffer.length,
      contentType
    });
  } catch (err: unknown) {
    console.error('Server storage upload failed:', err);
    return res.status(500).json({
      error: 'Failed to process document upload on server',
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

// Endpoint: Retrieve uploaded verification document
app.get('/api/storage/documents/:institutionId/:userId/:fileName', async (req, res) => {
  try {
    const { institutionId, userId, fileName } = req.params;
    const safeInstId = String(institutionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_');

    const filePath = path.join(UPLOADS_DIR, 'institutions', safeInstId, 'users', safeUserId, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Document not found');
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
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  } catch (err) {
    console.error('Error serving storage document:', err);
    return res.status(500).send('Error reading document');
  }
});

// Endpoint: Legacy retrieve verification document (backward compatibility)
app.get('/api/storage/documents/:userId/:fileName', async (req, res) => {
  try {
    const { userId, fileName } = req.params;
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_');

    // Try finding in default institution
    const defaultPath = path.join(UPLOADS_DIR, 'institutions', 'inst-main', 'users', safeUserId, safeFileName);
    if (fs.existsSync(defaultPath)) {
      const ext = path.extname(safeFileName).toLowerCase();
      res.setHeader('Content-Type', ext === '.webp' ? 'image/webp' : 'image/jpeg');
      return fs.createReadStream(defaultPath).pipe(res);
    }

    return res.status(404).send('Document not found');
  } catch (err) {
    return res.status(500).send('Error reading document');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusCare Server running on port ${PORT}`);
  });
}

startServer();
