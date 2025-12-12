import express from 'express';
import { authorize } from '@/middleware/auth';
import { permit } from '@/middleware/dashboard';

import {
    fetchPitchData,
    fetchPitchSettings,
    fetchPitchState,
    updatePitchPermissions,
    updatePitchSettings,
    updatePitchStatus,
} from '@/controllers/pitchController';

import {
    fetchConstraints,
    fetchSingleTimeslots,
    fetchPitchAccountData,
    createManagerBooking,
    fetchBookings
} from '@/controllers/bookingController';

import { 
    fetchAnalytics
} from '@/controllers/analyticsController';

const router = express.Router();

router.get('/:id/general', authorize, permit, fetchPitchState);
router.get('/:id', authorize, permit, fetchPitchData);

router.get('/:id/settings', authorize, permit, fetchPitchSettings);
router.post('/:id/settings', authorize, permit, updatePitchSettings);

router.post('/:id/status', authorize, permit, updatePitchStatus);
router.post('/:id/permissions', authorize, permit, updatePitchPermissions);
router.get('/:id/account', authorize, permit, fetchPitchAccountData);

router.get('/:id/bookings/general', authorize, permit, fetchConstraints);
router.post('/:id/bookings/create', authorize, permit, createManagerBooking);
router.get('/:id/bookings/availability/single', authorize, permit, fetchSingleTimeslots);
router.get('/:id/bookings/', authorize, permit, fetchBookings);

router.get('/:id/analytics/', authorize, permit, fetchAnalytics);

export default router;