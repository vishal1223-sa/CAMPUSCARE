import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

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
 * Uploads a single blob using uploadBytesResumable with retry handling and real-time progress callbacks
 */
export const uploadResumableWithRetry = async (
  blob: Blob,
  storagePath: string,
  contentType: string,
  customMetadata: Record<string, string>,
  onProgress?: (percent: number) => void,
  maxRetries = 2
): Promise<{ downloadUrl: string; storagePath: string }> => {
  let attempt = 0;

  const executeUpload = (): Promise<{ downloadUrl: string; storagePath: string }> => {
    return new Promise((resolve, reject) => {
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
          console.error(`Upload error on ${storagePath}:`, error);
          reject(error);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({ downloadUrl, storagePath });
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  };

  while (attempt <= maxRetries) {
    try {
      return await executeUpload();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw new Error(`Upload failed after ${maxRetries + 1} attempts: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Wait 500ms before retrying
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error('Upload could not be completed.');
};

/**
 * Optimized concurrent upload of front, back, and profile documents
 * Uploads all files in parallel, updating individual and overall progress
 */
export const uploadVerificationDocumentsConcurrent = async ({
  userId,
  frontBlob,
  backBlob,
  photoBlob,
  onProgress
}: {
  userId: string;
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
    const overallPercent = Math.round(sum / count);

    onProgress({
      frontPercent,
      backPercent,
      photoPercent,
      overallPercent,
      statusText: text,
      isUploading: true
    });
  };

  updateProgress('Preparing and compressing documents...');

  // 1. Client-side compression
  const [frontComp, backComp, photoComp] = await Promise.all([
    compressImageBeforeUpload(frontBlob, 1400, 1400, 0.82),
    backBlob ? compressImageBeforeUpload(backBlob, 1400, 1400, 0.82) : Promise.resolve(null),
    photoBlob ? compressImageBeforeUpload(photoBlob, 800, 800, 0.85) : Promise.resolve(null)
  ]);

  const frontExt = frontComp.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const frontPath = `idCards/${userId}/front_${timestamp}.${frontExt}`;

  updateProgress('Uploading documents concurrently to Firebase Storage...');

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
      { userId, docType: 'id_front', uploadedAt: new Date().toISOString() },
      (p) => {
        frontPercent = p;
        updateProgress(`Uploading ID Front: ${p}%`);
      }
    ),

    // Back upload (if present)
    backComp && backBlob
      ? uploadResumableWithRetry(
          backComp.blob,
          `idCards/${userId}/back_${timestamp}.${backComp.mimeType === 'image/webp' ? 'webp' : 'jpg'}`,
          backComp.mimeType,
          { userId, docType: 'id_back', uploadedAt: new Date().toISOString() },
          (p) => {
            backPercent = p;
            updateProgress(`Uploading ID Back: ${p}%`);
          }
        )
      : Promise.resolve(null),

    // Photo upload (if present)
    photoComp && photoBlob
      ? uploadResumableWithRetry(
          photoComp.blob,
          `profilePhotos/${userId}/photo_${timestamp}.${photoComp.mimeType === 'image/webp' ? 'webp' : 'jpg'}`,
          photoComp.mimeType,
          { userId, docType: 'profile_photo', uploadedAt: new Date().toISOString() },
          (p) => {
            photoPercent = p;
            updateProgress(`Uploading Profile Photo: ${p}%`);
          }
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
  return uploadResumableWithRetry(comp.blob, storagePath, comp.mimeType, {
    userId,
    documentType: `id_card_${side}`,
    uploadedAt: new Date().toISOString()
  });
};

export const uploadProfilePhotoDocument = async (
  file: File | Blob,
  userId: string
): Promise<{ downloadUrl: string; storagePath: string }> => {
  const comp = await compressImageBeforeUpload(file, 800, 800, 0.85);
  const ext = comp.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `profilePhotos/${userId}/photo_${Date.now()}.${ext}`;
  return uploadResumableWithRetry(comp.blob, storagePath, comp.mimeType, {
    userId,
    documentType: 'profile_photo',
    uploadedAt: new Date().toISOString()
  });
};
