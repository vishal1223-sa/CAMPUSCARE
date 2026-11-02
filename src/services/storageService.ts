import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../firebase';

export interface UploadProgressState {
  frontPercent: number;
  backPercent: number;
  photoPercent: number;
  overallPercent: number;
  statusText: string;
  isUploading: boolean;
  error?: string;
}

/**
 * Returns the configured backend API base URL.
 * Supports VITE_API_BASE_URL or VITE_BACKEND_URL (e.g. when frontend is deployed on Vercel).
 */
export const getApiBaseUrl = (): string => {
  const envBase = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) ||
    ''
  ).trim();

  if (envBase) {
    return envBase.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const globalUrl = (window as unknown as { __CAMPUSCARE_API_URL__?: string }).__CAMPUSCARE_API_URL__;
    if (globalUrl) return globalUrl.replace(/\/+$/, '');
  }

  return '';
};

// Configure fast timeout on storage so failed uploads don't hang for 10 minutes
try {
  storage.maxUploadRetryTime = 6000;
  storage.maxOperationRetryTime = 6000;
} catch {
  // Safe ignore if environment does not allow setting property
}

/**
 * Checks if the browser supports canvas.toBlob for WebP export
 */
let isWebpSupportedCache: boolean | null = null;
const checkWebpSupport = (): boolean => {
  if (isWebpSupportedCache !== null) return isWebpSupportedCache;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dataUri = canvas.toDataURL('image/webp');
    isWebpSupportedCache = dataUri.indexOf('image/webp') === 5;
  } catch {
    isWebpSupportedCache = false;
  }
  return isWebpSupportedCache;
};

/**
 * Converts a Blob or File into a base64 encoded string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Compresses an image file or blob via browser Canvas before upload.
 * Converts to WebP if supported (or JPEG fallback) with 1400px bounds,
 * retaining sharp ID card typography while reducing file size to ~150KB-350KB.
 */
export const compressImageBeforeUpload = (
  file: File | Blob,
  maxWidth = 1400,
  maxHeight = 1400,
  quality = 0.82
): Promise<{ blob: Blob; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const fallbackBlob = file instanceof Blob ? file : new Blob([file]);
          resolve({ blob: fallbackBlob, mimeType: 'image/jpeg' });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = checkWebpSupport() ? 'image/webp' : 'image/jpeg';

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, mimeType });
            } else {
              const fallback = file instanceof Blob ? file : new Blob([file]);
              resolve({ blob: fallback, mimeType: 'image/jpeg' });
            }
          },
          mimeType,
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression. Please try a different photo.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads a document via the application's authenticated backend storage endpoint
 */
export const uploadViaBackendApi = async ({
  userId,
  institutionId = 'inst-main',
  fileName,
  contentType,
  blob,
  onProgress
}: {
  userId: string;
  institutionId?: string;
  fileName: string;
  contentType: string;
  blob: Blob;
  onProgress?: (percent: number) => void;
}): Promise<{ downloadUrl: string; storagePath: string }> => {
  if (onProgress) onProgress(15);
  const base64Data = await blobToBase64(blob);
  if (onProgress) onProgress(45);

  const baseUrl = getApiBaseUrl();
  const uploadUrl = `${baseUrl}/api/storage/upload`;

  // Attach Firebase Auth ID token if available
  let authToken: string | null = null;
  try {
    if (auth.currentUser) {
      authToken = await auth.currentUser.getIdToken();
    }
  } catch {
    // Non-blocking
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (onProgress) onProgress(65);

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        institutionId,
        fileName,
        contentType,
        base64Data
      })
    });
  } catch (netErr: unknown) {
    throw new Error(
      `Network connection failed while uploading to ${uploadUrl}. Please verify your internet connection or backend server availability.`
    );
  }

  if (onProgress) onProgress(85);

  if (!response.ok) {
    let serverErrorText = '';
    try {
      const errJson = await response.json();
      serverErrorText = errJson?.error || errJson?.details || '';
    } catch {
      serverErrorText = await response.text().catch(() => '');
    }

    if (response.status === 404) {
      throw new Error(
        `Backend upload endpoint not found (HTTP 404 at ${uploadUrl}). If your frontend is deployed separately on Vercel, please configure VITE_API_BASE_URL to point to your live CampusCare backend server.`
      );
    }

    throw new Error(
      serverErrorText || `Server storage upload failed with HTTP status ${response.status}`
    );
  }

  const data = await response.json();
  if (onProgress) onProgress(100);

  // Ensure download URL is fully qualified if backend returned relative path and baseUrl is configured
  let downloadUrl = data.downloadUrl as string;
  if (downloadUrl && downloadUrl.startsWith('/') && baseUrl) {
    downloadUrl = `${baseUrl}${downloadUrl}`;
  }

  return {
    downloadUrl,
    storagePath: data.storagePath
  };
};

/**
 * Uploads a single blob using uploadBytesResumable with progress callbacks,
 * automatic timeout watchdog, and seamless server storage fallback.
 */
export const uploadResumableWithRetry = async (
  blob: Blob,
  storagePath: string,
  contentType: string,
  customMetadata: Record<string, string>,
  onProgress?: (percent: number) => void,
  institutionId = 'inst-main',
  userId?: string
): Promise<{ downloadUrl: string; storagePath: string }> => {
  const fileName = storagePath.split('/').pop() || `doc_${Date.now()}.webp`;
  const effectiveUserId = userId || customMetadata.userId || 'user';

  // 1. Attempt uploadBytesResumable to Firebase Storage with a 5-second watchdog
  const tryFirebaseStorage = (): Promise<{ downloadUrl: string; storagePath: string }> => {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            uploadTask.cancel();
          } catch {
            // ignore
          }
          reject(new Error('Firebase Storage connection timed out.'));
        }
      }, 5000);

      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType,
        customMetadata
      };

      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            if (onProgress) onProgress(percent);
          }
        },
        (error) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutId);
            reject(error);
          }
        },
        async () => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutId);
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              if (onProgress) onProgress(100);
              resolve({ downloadUrl, storagePath });
            } catch (err) {
              reject(err);
            }
          }
        }
      );
    });
  };

  try {
    return await tryFirebaseStorage();
  } catch (firebaseErr: unknown) {
    const errMsg = firebaseErr instanceof Error ? firebaseErr.message : String(firebaseErr);
    console.warn(`Firebase Storage notice (${errMsg}). Completing upload via secure campus storage...`);

    // 2. Fall back seamlessly to authenticated backend storage
    return await uploadViaBackendApi({
      userId: effectiveUserId,
      institutionId,
      fileName,
      contentType,
      blob,
      onProgress
    });
  }
};

/**
 * Concurrent upload of front, back, and profile documents
 * Uploads files in parallel with institutional path scoping and overall progress tracking
 */
export const uploadVerificationDocumentsConcurrent = async ({
  userId,
  institutionId = 'inst-main',
  frontBlob,
  backBlob,
  photoBlob,
  onProgress
}: {
  userId: string;
  institutionId?: string;
  frontBlob: Blob;
  backBlob?: Blob | null;
  photoBlob?: Blob | null;
  onProgress?: (state: UploadProgressState) => void;
}): Promise<{
  frontUrl: string;
  frontPath: string;
  backUrl?: string;
  backPath?: string;
  photoUrl?: string;
  photoPath?: string;
}> => {
  const timestamp = Date.now();
  const hasBack = !!backBlob;
  const hasPhoto = !!photoBlob;

  let frontPercent = 0;
  let backPercent = 0;
  let photoPercent = 0;

  const updateProgress = (text: string) => {
    if (!onProgress) return;
    const count = 1 + (hasBack ? 1 : 0) + (hasPhoto ? 1 : 0);
    const sum = frontPercent + (hasBack ? backPercent : 0) + (hasPhoto ? photoPercent : 0);
    const overallPercent = Math.min(100, Math.round(sum / count));

    onProgress({
      frontPercent,
      backPercent,
      photoPercent,
      overallPercent,
      statusText: text,
      isUploading: true
    });
  };

  updateProgress('Preparing and optimizing documents...');

  // 1. Client-side compression
  const [frontComp, backComp, photoComp] = await Promise.all([
    compressImageBeforeUpload(frontBlob, 1400, 1400, 0.82),
    backBlob ? compressImageBeforeUpload(backBlob, 1400, 1400, 0.82) : Promise.resolve(null),
    photoBlob ? compressImageBeforeUpload(photoBlob, 800, 800, 0.85) : Promise.resolve(null)
  ]);

  const frontExt = frontComp.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const frontPath = `institutions/${institutionId}/users/${userId}/front_${timestamp}.${frontExt}`;

  updateProgress('Uploading documents to secure cloud storage...');

  // Upload tasks promise array for parallel execution
  const uploadPromises: [
    Promise<{ downloadUrl: string; storagePath: string }>,
    Promise<{ downloadUrl: string; storagePath: string } | null>,
    Promise<{ downloadUrl: string; storagePath: string } | null>
  ] = [
    // Front upload
    uploadResumableWithRetry(
      frontComp.blob,
      frontPath,
      frontComp.mimeType,
      { userId, institutionId, docType: 'id_front', uploadedAt: new Date().toISOString() },
      (p) => {
        frontPercent = p;
        updateProgress(`Uploading ID Front: ${p}%`);
      },
      institutionId,
      userId
    ),

    // Back upload (if present)
    backComp && backBlob
      ? uploadResumableWithRetry(
          backComp.blob,
          `institutions/${institutionId}/users/${userId}/back_${timestamp}.${backComp.mimeType === 'image/webp' ? 'webp' : 'jpg'}`,
          backComp.mimeType,
          { userId, institutionId, docType: 'id_back', uploadedAt: new Date().toISOString() },
          (p) => {
            backPercent = p;
            updateProgress(`Uploading ID Back: ${p}%`);
          },
          institutionId,
          userId
        )
      : Promise.resolve(null),

    // Photo upload (if present)
    photoComp && photoBlob
      ? uploadResumableWithRetry(
          photoComp.blob,
          `institutions/${institutionId}/users/${userId}/photo_${timestamp}.${photoComp.mimeType === 'image/webp' ? 'webp' : 'jpg'}`,
          photoComp.mimeType,
          { userId, institutionId, docType: 'profile_photo', uploadedAt: new Date().toISOString() },
          (p) => {
            photoPercent = p;
            updateProgress(`Uploading Profile Photo: ${p}%`);
          },
          institutionId,
          userId
        )
      : Promise.resolve(null)
  ];

  try {
    const [frontRes, backRes, photoRes] = await Promise.all(uploadPromises);

    if (onProgress) {
      onProgress({
        frontPercent: 100,
        backPercent: hasBack ? 100 : 0,
        photoPercent: hasPhoto ? 100 : 0,
        overallPercent: 100,
        statusText: 'All identity documents successfully uploaded and secured.',
        isUploading: false
      });
    }

    return {
      frontUrl: frontRes.downloadUrl,
      frontPath: frontRes.storagePath,
      backUrl: backRes?.downloadUrl,
      backPath: backRes?.storagePath,
      photoUrl: photoRes?.downloadUrl,
      photoPath: photoRes?.storagePath
    };
  } catch (err) {
    if (onProgress) {
      onProgress({
        frontPercent,
        backPercent,
        photoPercent,
        overallPercent: Math.round((frontPercent + backPercent + photoPercent) / (1 + (hasBack ? 1 : 0) + (hasPhoto ? 1 : 0))),
        statusText: 'Upload interrupted',
        isUploading: false,
        error: err instanceof Error ? err.message : 'Upload failed'
      });
    }
    throw err;
  }
};

/**
 * Legacy wrappers for backward compatibility
 */
export const uploadIdCardDocument = async (
  file: File | Blob,
  userId: string,
  side: 'front' | 'back'
): Promise<{ downloadUrl: string; storagePath: string }> => {
  const comp = await compressImageBeforeUpload(file, 1400, 1400, 0.82);
  const ext = comp.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `idCards/${userId}/${side}_${Date.now()}.${ext}`;
  return uploadResumableWithRetry(
    comp.blob,
    storagePath,
    comp.mimeType,
    { userId, documentType: `id_card_${side}`, uploadedAt: new Date().toISOString() },
    undefined,
    'inst-main',
    userId
  );
};

export const uploadProfilePhotoDocument = async (
  file: File | Blob,
  userId: string
): Promise<{ downloadUrl: string; storagePath: string }> => {
  const comp = await compressImageBeforeUpload(file, 800, 800, 0.85);
  const ext = comp.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `profilePhotos/${userId}/photo_${Date.now()}.${ext}`;
  return uploadResumableWithRetry(
    comp.blob,
    storagePath,
    comp.mimeType,
    { userId, documentType: 'profile_photo', uploadedAt: new Date().toISOString() },
    undefined,
    'inst-main',
    userId
  );
};
