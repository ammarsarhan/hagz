import { Router } from 'express';

import AuthController from '@/domains/auth/auth.controller';
import authorize from '@/shared/middleware/authorize.middleware';

const router = Router();

const controller = new AuthController();

router.post('/sign-up/user', controller.signUpUser);
router.post('/sign-up/owner', controller.signUpOwner);
router.post('/sign-in', controller.signIn);
router.get('/session', authorize(true), controller.fetchSession)

export default router;
