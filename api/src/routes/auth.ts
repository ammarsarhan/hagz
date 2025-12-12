import express from 'express';

import { 
    signUpWithCredentials,
    signInWithCredentials,
    signUpWithGoogle,
    signInWithGoogle,
    signUpWithMeta,
    signInWithMeta,
    verifyWithEmail,
    fetchVerificationData,
    issueVerificationToken,
    refreshTokens,
    fetchSession,
    signOut
} from '@/controllers/authController'

import { authorize, optionalAuthorize } from '@/middleware/auth';

const router = express.Router();

// Credentials implementation
router.post('/sign-up', signUpWithCredentials);
router.post('/sign-in', signInWithCredentials);

// Google OAUTH2 implementation
router.post('/sign-up', signUpWithGoogle);
router.post('/sign-in', signInWithGoogle);

// Meta OAUTH2 implementation
router.post('/sign-up', signUpWithMeta);
router.post('/sign-in', signInWithMeta);

// Verification handler
router.post('/verify/send', authorize, issueVerificationToken);
router.get('/verify', authorize, fetchVerificationData);
router.post('/verify', authorize, verifyWithEmail);

// Refresh & Session
router.get('/session', optionalAuthorize, fetchSession)
router.post('/refresh', refreshTokens);
router.get('/sign-out', signOut);

export default router;