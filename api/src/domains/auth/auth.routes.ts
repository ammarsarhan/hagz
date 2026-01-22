import express from 'express';

import AuthController from '@/domains/auth/auth.controller';

const router = express.Router();

const controller = new AuthController();

router.post('/sign-up/user', controller.signUpUser);
router.post('/sign-in', controller.signIn);

export default router;
