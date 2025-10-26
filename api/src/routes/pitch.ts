import express from 'express';
import { authorize } from '@/middleware/auth';
import { permit } from '@/middleware/dashboard';

import { 
    createPitchBooking,
    fetchPitchData,
    fetchPitchSettings,
    fetchPitchState,
    updatePitchPermissions,
    updatePitchSettings,
    updatePitchStatus,
    checkPitchAvailability
} from '@/controllers/pitchController';

const router = express.Router();

router.get('/:id/general', authorize, permit, fetchPitchState);
router.get('/:id', authorize, permit, fetchPitchData);

router.get('/:id/settings', authorize, permit, fetchPitchSettings);
router.post('/:id/settings', authorize, permit, updatePitchSettings);

router.post('/:id/status', authorize, permit, updatePitchStatus);
router.post('/:id/permissions', authorize, permit, updatePitchPermissions);

router.post('/:id/bookings/availability', authorize, permit, checkPitchAvailability);
router.post('/:id/bookings/create', authorize, permit, createPitchBooking);

export default router;