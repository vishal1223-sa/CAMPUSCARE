import { AutomatedCheckResult, AutomatedCheckStatus } from '../types';
import { compareCourses, normalizeText } from './courseService';

/**
 * Normalizes an identifier (removes spaces, hyphens, slashes, punctuation, uppercase)
 */
export const normalizeIdentifier = (val: string): string => {
  return val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

/**
 * Normalizes person name (lowercase, letters and spaces only, collapsed spacing)
 */
export const normalizeName = (val: string): string => {
  return val
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Preprocesses an image blob on an off-screen canvas (contrast enhancement and grayscale)
 * to maximize OCR recognition accuracy for ID cards.
 */
export const preprocessImageForOcr = (blob: Blob): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(blob);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        // Apply grayscale and contrast boost
        for (let i = 0; i < d.length; i += 4) {
          const avg = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const contrast = 1.25;
          const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
          const adjusted = Math.min(255, Math.max(0, factor * (avg - 128) + 128));

          d[i] = adjusted;
          d[i + 1] = adjusted;
          d[i + 2] = adjusted;
        }

        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob(
          (b) => resolve(b || blob),
          'image/jpeg',
          0.9
        );
      };
      img.onerror = () => resolve(blob);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(blob);
    reader.readAsDataURL(blob);
  });
};

/**
 * Performs OCR and cross-references student credentials (Full Name, Roll Number, Course)
 * without requiring any central student registry.
 */
export const performStudentIdOcr = async (
  imageBlob: Blob,
  targetDetails: {
    fullName: string;
    rollNumber: string;
    course: string;
  },
  institutionAliases?: Record<string, string[]>
): Promise<AutomatedCheckResult> => {
  const DISCLAIMER =
    'Automated ID Card analysis assists administrators by transcribing and cross-referencing document fields. Final enrollment authorization is verified by campus administrators.';

  const flaggedReasons: string[] = [];

  try {
    const preprocessed = await preprocessImageForOcr(imageBlob);

    // Timeout promise after 15 seconds
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('OCR recognition timed out')), 15000)
    );

    const workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const ret = await worker.recognize(preprocessed);
      await worker.terminate();
      return ret;
    })();

    const result = await Promise.race([workerPromise, timeoutPromise]);
    const text = result.data.text || '';
    const confidence = Math.round(result.data.confidence || 0);
    const trimmedText = text.trim();

    if (trimmedText.length < 8 || confidence < 15) {
      flaggedReasons.push('ID card text was unreadable or low resolution. Manual administrator verification required.');
      return {
        status: 'Manual Review Required',
        ocrConfidence: confidence,
        nameMatch: false,
        rollNumberMatch: false,
        courseMatch: false,
        detectedText: trimmedText,
        disclaimer: DISCLAIMER,
        checkedAt: new Date().toISOString(),
        flaggedReasons
      };
    }

    const normOcrClean = normalizeText(text);
    const compactOcr = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 1. Strict Roll Number matching
    const normRoll = normalizeIdentifier(targetDetails.rollNumber);
    // Direct compact match or tokenized match
    const rollTokens = targetDetails.rollNumber.split(/[-_\s/]+/).filter((t) => t.length >= 2);
    const rollNumberMatch =
      compactOcr.includes(normRoll) ||
      (rollTokens.length > 0 && rollTokens.every((tok) => compactOcr.includes(normalizeIdentifier(tok))));

    if (!rollNumberMatch) {
      flaggedReasons.push(`Roll Number "${targetDetails.rollNumber}" was not cleanly identified in the card text.`);
    }

    // 2. Normalized Name matching (token overlap, order-independent)
    const normEnteredName = normalizeName(targetDetails.fullName);
    const nameTokens = normEnteredName.split(' ').filter((p) => p.length >= 2);
    const matchedTokens = nameTokens.filter((token) => normOcrClean.includes(token));

    const nameMatch =
      normOcrClean.includes(normEnteredName) ||
      matchedTokens.length >= Math.max(1, Math.min(2, nameTokens.length));

    if (!nameMatch) {
      flaggedReasons.push(`Name "${targetDetails.fullName}" does not have high-confidence match with extracted card text.`);
    }

    // 3. Flexible Course matching using aliases
    const courseComparison = compareCourses(targetDetails.course, text, institutionAliases);
    const courseMatch = courseComparison.matched;

    if (!courseMatch) {
      flaggedReasons.push(`Course "${targetDetails.course}" differed from text detected on card.`);
    }

    // Overall outcome:
    // If all three match -> Passed
    // If any does not match -> Manual Review Required (NEVER auto-reject student!)
    const allPassed = rollNumberMatch && nameMatch && courseMatch;
    const finalStatus: AutomatedCheckStatus = allPassed ? 'Passed' : 'Manual Review Required';

    return {
      status: finalStatus,
      ocrConfidence: confidence,
      nameMatch,
      rollNumberMatch,
      courseMatch,
      detectedText: trimmedText,
      detectedCourse: courseComparison.detectedCourse,
      disclaimer: DISCLAIMER,
      checkedAt: new Date().toISOString(),
      flaggedReasons
    };
  } catch (err) {
    console.warn('Student OCR processing encountered error or timeout:', err);
    return {
      status: 'Manual Review Required',
      ocrConfidence: 0,
      nameMatch: false,
      rollNumberMatch: false,
      courseMatch: false,
      detectedText: '',
      disclaimer: DISCLAIMER,
      checkedAt: new Date().toISOString(),
      flaggedReasons: ['OCR recognition encountered a timeout or connection delay. Document submitted for Administrator Manual Review.']
    };
  }
};

/**
 * Performs OCR for Staff/Admin ID card to verify Name
 */
export const performStaffIdOcr = async (
  imageBlob: Blob,
  fullName: string
): Promise<{ nameMatch: boolean; ocrConfidence: number; rawText: string; reason?: string }> => {
  try {
    const preprocessed = await preprocessImageForOcr(imageBlob);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('OCR recognition timed out')), 15000)
    );

    const workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const ret = await worker.recognize(preprocessed);
      await worker.terminate();
      return ret;
    })();

    const result = await Promise.race([workerPromise, timeoutPromise]);
    const text = result.data.text || '';
    const confidence = Math.round(result.data.confidence || 0);

    const normOcr = normalizeText(text);
    const normName = normalizeName(fullName);
    const nameTokens = normName.split(' ').filter((p) => p.length >= 2);
    const matchedTokens = nameTokens.filter((token) => normOcr.includes(token));

    const nameMatch =
      normOcr.includes(normName) ||
      matchedTokens.length >= Math.max(1, Math.min(2, nameTokens.length));

    return {
      nameMatch,
      ocrConfidence: confidence,
      rawText: text.trim(),
      reason: nameMatch ? undefined : `Name "${fullName}" was not clearly isolated in ID card text.`
    };
  } catch (err) {
    console.warn('Staff OCR processing error:', err);
    return {
      nameMatch: false,
      ocrConfidence: 0,
      rawText: '',
      reason: 'OCR evaluation timed out. Administrator manual review will verify staff credentials.'
    };
  }
};

// Deprecated alias for legacy callers
export const performIdCardOcr = async (
  imageBlob: Blob,
  targetDetails: { fullName: string; rollNumber: string; collegeId: string }
): Promise<AutomatedCheckResult> => {
  return performStudentIdOcr(imageBlob, {
    fullName: targetDetails.fullName,
    rollNumber: targetDetails.rollNumber || targetDetails.collegeId,
    course: 'General'
  });
};
