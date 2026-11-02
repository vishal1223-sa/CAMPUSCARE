# CampusCare – Critical Bug Fix: Firestore Undefined Values During Google Login

This patch resolves the urgent Firestore exception that occurred during user authentication:
`Function setDoc() called with invalid data. Unsupported field value: undefined (found in field isSuperAdmin in document users/{uid})`

***

### 1. Root Cause Analysis

1. **`isSuperAdmin: isSuperAdmin || undefined` in `src/context/AuthContext.tsx`**:
   - For regular users (Students and Staff), `isSuperAdmin` evaluated to `false`.
   - The expression `false || undefined` resolved to `undefined`.
   - Passing `isSuperAdmin: undefined` into `setDoc(userRef, newProfile)` caused the Firestore SDK to reject the write with a fatal exception.

2. **`photoURL: firebaseUser.photoURL || undefined`**:
   - If a Google account had no profile avatar or `photoURL` was `null`, `null || undefined` resulted in `photoURL: undefined`.
   - Firestore rejected the document write whenever an avatar was absent.

3. **`undefined` Passed into `updateDoc` and Transaction Updates**:
   - In `verificationService.ts`, resubmissions passed `rejectionRemarks: undefined`, `reviewedAt: undefined`, `reviewedBy: undefined`, and `reviewerName: undefined` to `updateDoc`. Firestore requires `deleteField()` rather than `undefined` to clear properties.
   - In `OnboardingGate.tsx` and `ProfilePage.tsx`, optional fields (e.g., `designation`, `collegeName`, `specialization`) were using ternary expressions returning `undefined` rather than omitting the keys or using sanitized objects.

***

### 2. Architecture & Data Model Fixes

1. **Strict Boolean Typing & Object Construction**:
   - Updated `UserProfile.isSuperAdmin` in `src/types.ts` to strict `boolean` (never `boolean | undefined`).
   - For newly created profiles in `AuthContext.tsx`:
     - Regular user profiles are initialized with `isSuperAdmin: false` explicitly.
     - Authorized Super Admins are initialized with `isSuperAdmin: true`.
     - Optional fields (like `photoURL`) are conditionally included only when valid strings exist (`...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {})`).

2. **Preservation of Existing Profiles & Backfill Safety**:
   - For existing user profiles, `existingData.isSuperAdmin === true` is strictly preserved and never overwritten with `false`.
   - If legacy user records lacked the `isSuperAdmin` field (i.e. `typeof existingData.isSuperAdmin !== 'boolean'`), the authoritative `/admins/{uid}` document is queried, and the boolean value is safely backfilled without risk of privilege escalation.

3. **Authoritative Super Admin Bootstrap & Access Control**:
   - Preserved designated root Super Admin: `vishalkokkula07@gmail.com`.
   - Authoritative Super Admin status is written to `/admins/{uid}` and `/users/{uid}` with `isSuperAdmin: true`.
   - The runtime `isSuperAdmin` state in `AuthContext` checks `profile?.isSuperAdmin === true` directly, rather than relying on client-side email string matching alone.

4. **Recursive Payload Sanitizer (`cleanFirestorePayload`)**:
   - Implemented and exported `cleanFirestorePayload<T>` in `src/firebase.ts`.
   - Recursively traverses objects and strips any keys with `undefined` values while preserving FieldValues (`deleteField()`, `serverTimestamp()`), Dates, and arrays.
   - Applied across `AuthContext`, `verificationService`, `usersService`, `complaintsService`, and `institutionService`.

5. **Proper Field Deletion in `updateDoc`**:
   - In `resubmitVerificationRequest`, replaced `undefined` with `deleteField()` for review metadata (`rejectionRemarks`, `reviewedAt`, `reviewedBy`, `reviewerName`, and `rejectionReason`).

***

### 3. Verification & Build Results

- **`tsc --noEmit`**: 0 errors.
- **`compile_applet`**: Production build completed successfully.
- **Dev Server**: Running on port 3000.
