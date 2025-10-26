import express from 'express';
import { authorize, optionalAuthorize } from '@/middleware/auth';
import { permit } from '@/middleware/dashboard';

import { 
    createInvitation,
    updateInvitation,
    fetchInvitation,
} from '@/controllers/invitationController';

const router = express.Router();

router.post('/create', authorize, permit, createInvitation);
router.get('/:token', optionalAuthorize, fetchInvitation);
router.post('/:token', authorize, updateInvitation);

export default router;