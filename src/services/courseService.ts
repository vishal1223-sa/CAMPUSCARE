/**
 * Course Matching & Alias Normalization Service
 * Supports flexible cross-referencing between student input and ID card OCR text.
 * Allows institutions to configure custom course aliases.
 */

export const DEFAULT_COURSE_ALIASES: Record<string, string[]> = {
  'B.Sc Computer Science': [
    'bsc computer science',
    'b.sc computer science',
    'bsc cs',
    'b.sc cs',
    'b.sc (cs)',
    'tybsc cs',
    'sybsc cs',
    'fybsc cs',
    'bachelor of science in computer science',
    'bachelor of science (computer science)',
    'b.sc. c.s.',
    'computer science'
  ],
  'B.Sc Information Technology': [
    'bsc information technology',
    'b.sc information technology',
    'bsc it',
    'b.sc it',
    'b.sc (it)',
    'tybsc it',
    'sybsc it',
    'fybsc it',
    'bachelor of science in information technology',
    'information technology'
  ],
  'B.Tech Computer Science & Engineering': [
    'btech cse',
    'b.tech cse',
    'b.tech computer science',
    'btech computer science',
    'b.e. computer science',
    'be cse',
    'bachelor of technology in computer science',
    'computer science & engineering'
  ],
  'B.Tech Mechanical Engineering': [
    'btech mechanical',
    'b.tech mechanical',
    'btech mech',
    'b.tech mech',
    'be mechanical',
    'bachelor of technology in mechanical engineering',
    'mechanical engineering'
  ],
  'B.Tech Electrical Engineering': [
    'btech electrical',
    'b.tech electrical',
    'btech eee',
    'btech ece',
    'be electrical',
    'electrical engineering',
    'electronics and communication'
  ],
  'B.Tech Civil Engineering': [
    'btech civil',
    'b.tech civil',
    'be civil',
    'civil engineering',
    'bachelor of technology in civil engineering'
  ],
  'Bachelor of Commerce (B.Com)': [
    'b.com',
    'bcom',
    'bachelor of commerce',
    'tybcom',
    'sybcom',
    'fybcom'
  ],
  'Bachelor of Business Administration (BBA)': [
    'bba',
    'b.b.a.',
    'bachelor of business administration'
  ],
  'Master of Computer Applications (MCA)': [
    'mca',
    'm.c.a.',
    'master of computer applications'
  ],
  'M.Sc Computer Science': [
    'msc computer science',
    'm.sc computer science',
    'msc cs',
    'm.sc cs',
    'master of science in computer science'
  ]
};

/**
 * Normalizes text for lenient keyword matching (lowercase, alphanumeric, collapsed spaces)
 */
export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Compares an entered course against text extracted from an ID card,
 * testing for direct matches, token overlaps, and alias dictionary mappings.
 */
export const compareCourses = (
  enteredCourse: string,
  extractedOcrText: string,
  institutionAliases?: Record<string, string[]>
): { matched: boolean; detectedCourse?: string; confidence: number } => {
  if (!enteredCourse || !extractedOcrText) {
    return { matched: false, confidence: 0 };
  }

  const normEntered = normalizeText(enteredCourse);
  const normOcr = normalizeText(extractedOcrText);

  // 1. Direct substring match
  if (normOcr.includes(normEntered) && normEntered.length > 2) {
    return { matched: true, detectedCourse: enteredCourse, confidence: 95 };
  }

  // 2. Combine default and custom institutional aliases
  const mergedAliases: Record<string, string[]> = {
    ...DEFAULT_COURSE_ALIASES,
    ...(institutionAliases || {})
  };

  // Find if entered course maps to an alias group
  let targetAliases: string[] = [];
  for (const [canonicalCourse, aliases] of Object.entries(mergedAliases)) {
    const normCanonical = normalizeText(canonicalCourse);
    const normalizedGroup = aliases.map(normalizeText);

    if (
      normCanonical === normEntered ||
      normalizedGroup.includes(normEntered) ||
      normEntered.includes(normCanonical)
    ) {
      targetAliases = Array.from(new Set([normCanonical, ...normalizedGroup]));
      break;
    }
  }

  // If not found in known list, generate dynamic variants from entered tokens
  if (targetAliases.length === 0) {
    targetAliases = [normEntered];
    // Example: "B.Sc Computer Science" -> ["bsc", "computer", "science"]
    const tokens = normEntered.split(' ').filter((t) => t.length > 2);
    if (tokens.length >= 2) {
      targetAliases.push(tokens.join(' '));
    }
  }

  // Check aliases against OCR text
  for (const alias of targetAliases) {
    if (normOcr.includes(alias) && alias.length > 2) {
      return {
        matched: true,
        detectedCourse: alias.toUpperCase(),
        confidence: 90
      };
    }
  }

  // 3. Significant token overlap check (at least 2 substantial keywords or 70% of tokens)
  const enteredTokens = normEntered
    .split(' ')
    .filter((t) => t.length > 2 && !['and', 'for', 'the', 'in', 'of'].includes(t));

  if (enteredTokens.length > 0) {
    const matchedTokens = enteredTokens.filter((token) => normOcr.includes(token));
    const matchRatio = matchedTokens.length / enteredTokens.length;

    if (matchRatio >= 0.6 || (matchedTokens.length >= 2 && matchedTokens.length === enteredTokens.length)) {
      return {
        matched: true,
        detectedCourse: matchedTokens.join(' ').toUpperCase(),
        confidence: Math.round(matchRatio * 85)
      };
    }
  }

  return {
    matched: false,
    confidence: 20
  };
};

/**
 * Standard university course list options for student onboarding dropdown
 */
export const POPULAR_COURSES = [
  'B.Sc Computer Science',
  'B.Sc Information Technology',
  'B.Tech Computer Science & Engineering',
  'B.Tech Mechanical Engineering',
  'B.Tech Electrical Engineering',
  'B.Tech Civil Engineering',
  'Bachelor of Commerce (B.Com)',
  'Bachelor of Business Administration (BBA)',
  'Master of Computer Applications (MCA)',
  'M.Sc Computer Science',
  'Other / Custom Course'
];
