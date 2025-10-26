import express from 'express';
import rateLimit from "express-rate-limit";

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
    refreshTokens
} from '@/controllers/authController'

import { authorize } from '@/middleware/auth';

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

// Refresh 
router.post('/refresh', refreshTokens);

export default router;