import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS for Vercel, Cloud Run, and local development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CampusCare-Institution');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Enable JSON body parsing with adequate limit for compressed image uploads
app.use(express.json({ limit: '25mb' }));

// Helper to decode and validate Firebase ID token JWT claims
function parseAndValidateFirebaseToken(authHeader?: string): { uid: string; email?: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    // Validate standard Firebase claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn('Expired Firebase ID token received');
      return null;
    }

    if (payload.aud && payload.aud !== firebaseConfig.projectId) {
      console.warn(`Token audience notice: ${payload.aud}`);
    }

    if (payload.sub || payload.user_id) {
      return {
        uid: payload.sub || payload.user_id,
        email: payload.email
      };
    }
  } catch (err) {
    console.warn('Notice parsing Firebase token:', err);
  }
  return null;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusCare Backend Storage API',
    architecture: 'Multi-Institution ID-Card Verification',
    environment: process.env.NODE_ENV || 'development',
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

    // Validate authenticated token if provided
    const authHeader = req.headers.authorization;
    const authUser = parseAndValidateFirebaseToken(authHeader);

    // If an auth header was provided, ensure it matches the uploaded userId
    if (authUser && authUser.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden: Authenticated user does not match the requested upload ownership.'
      });
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

    // Construct full URL if host header is available
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
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
    console.error('Error serving storage document:', err);
    return res.status(500).json({ error: 'Error reading document' });
  }
});

// Endpoint: Legacy retrieve verification document (backward compatibility)
app.get('/api/storage/documents/:userId/:fileName', async (req, res) => {
  try {
    const { userId, fileName } = req.params;
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_');

    const defaultPath = path.join(UPLOADS_DIR, 'institutions', 'inst-main', 'users', safeUserId, safeFileName);
    if (fs.existsSync(defaultPath)) {
      const ext = path.extname(safeFileName).toLowerCase();
      res.setHeader('Content-Type', ext === '.webp' ? 'image/webp' : 'image/jpeg');
      return fs.createReadStream(defaultPath).pipe(res);
    }

    return res.status(404).json({ error: 'Document not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Error reading document' });
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
