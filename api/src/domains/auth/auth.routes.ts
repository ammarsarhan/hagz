import express from 'express';

import AuthController from '@/domains/auth/auth.controller';
import AuthService from '@/domains/auth/auth.service';

const router = express.Router();

const service = new AuthService();
const controller = new AuthController(service);

router.post('/user/sign-up', controller.signUpUser);

export default router;
