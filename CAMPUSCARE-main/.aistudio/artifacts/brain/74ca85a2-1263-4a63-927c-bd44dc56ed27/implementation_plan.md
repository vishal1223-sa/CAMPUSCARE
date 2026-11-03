# CampusCare – Resolution of Production Student Document Upload HTTP 404

This patch diagnoses and resolves the production issue where student ID document upload failed with `"Server storage upload failed with HTTP 404"`.

***

### 1. Actual Production Request & Root Cause Diagnosis

1. **Exact Failing Request**:
   - Method: `POST`
   - Request Path: `/api/storage/upload`
   - Request URL: `https://<published-frontend-domain>/api/storage/upload`
   - Response Status: `HTTP 404 Not Found`
   - Response Body: HTML 404 Page (`<title>404 Page not found</title>`)

2. **Root Cause Identification**:
   - The frontend (`src/services/storageService.ts`) was hardcoded to call a relative URL: `fetch('/api/storage/upload', ...)`.
   - In production environments where the frontend is deployed to static hosting (such as Vercel or a static Vite preview container), the hosting provider only serves static files from `dist/`.
   - The Express server (`server.ts`) was not running on that domain, and no serverless API routes (`api/`) were configured on Vercel.
   - When the browser dispatched `POST /api/storage/upload`, the static hosting router attempted to find a file at `/dist/api/storage/upload`, failed, and returned **HTTP 404**.
   - `storageService.ts` threw the error `"Server storage upload failed with HTTP 404"`.

***

### 2. Solutions Implemented

1. **Configurable API Base URL (`getApiBaseUrl`)**:
   - Added `getApiBaseUrl()` in `src/services/storageService.ts`:
     - Checks `import.meta.env.VITE_API_BASE_URL` or `import.meta.env.VITE_BACKEND_URL`.
     - Supports runtime `window.__CAMPUSCARE_API_URL__`.
     - Falls back to same-origin relative path when frontend and backend are co-hosted on Express / Cloud Run.
   - Documented `VITE_API_BASE_URL` in `.env.example`.

2. **CORS & Preflight Handling in `server.ts`**:
   - Configured cross-origin resource sharing middleware supporting:
     - `Access-Control-Allow-Origin: <request origin>` (allowing Vercel, Cloud Run, and local origins)
     - `Access-Control-Allow-Credentials: true`
     - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH`
     - `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CampusCare-Institution`
     - Automatic handling of `OPTIONS` preflight requests (returning HTTP 204).

3. **Authentication Token Validation & Path Scoping**:
   - Frontend now passes the Firebase ID token in `Authorization: Bearer <idToken>`.
   - `server.ts` parses and validates JWT claims (`uid`, `exp`, `aud`).
   - Rejects mismatched user IDs with `HTTP 403 Forbidden`.
   - File uploads are isolated per institution and user: `institutions/${institutionId}/users/${userId}/${fileName}`.

4. **Vercel Serverless Function Support**:
   - Created `/api/storage/upload.ts` and `/api/storage/documents/[institutionId]/[userId]/[fileName].ts`.
   - Created `/vercel.json` with SPA and `/api/` routing rewrites.
   - If the repository is deployed directly on Vercel as a single project, Vercel automatically deploys `/api/storage/upload` as a serverless function without requiring a separate backend.

5. **Enhanced Frontend Error Handling**:
   - If HTTP 404 occurs, the error message specifically details:
     `"Backend upload endpoint not found (HTTP 404 at ${uploadUrl}). If your frontend is deployed separately on Vercel, please configure VITE_API_BASE_URL to point to your live CampusCare backend server."`
   - Keeps entered details and selected files intact.
   - Resets submission lock and displays a **Retry Submission** button.

***

### 3. Verification & Test Results

1. **CORS Preflight Test (`OPTIONS /api/storage/upload`)**:
   - Tested from origin `https://campuscare-demo.vercel.app`.
   - Returned `HTTP 204 No Content` with appropriate `Access-Control-Allow-Origin` and allowed methods.

2. **Upload Endpoint Test (`POST /api/storage/upload`)**:
   - Tested with Vercel origin and payload.
   - Returned `HTTP 200 OK` with valid `downloadUrl` and `storagePath`.

3. **Document Retrieval Test (`GET /api/storage/documents/...`)**:
   - Tested document retrieval; returned `HTTP 200 OK` with `Content-Type: image/webp` and verified image bytes.

4. **Code Quality**:
   - `tsc --noEmit`: 0 errors.
   - `compile_applet`: Succeeded.
