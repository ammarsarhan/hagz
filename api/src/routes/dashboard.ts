import { authorize } from '@/middleware/auth';
import express from 'express';

import {
    fetchDashboard,
    fetchPitches,
    fetchPitchCreateState,
    createPitchRequest
} from '@/controllers/dashboardController';

const router = express.Router();

// Fetch dashboard data
router.get('/', authorize, fetchDashboard);

// Dashboard pitch create data
router.get('/pitches', authorize, fetchPitches);
router.get('/pitches/create', authorize, fetchPitchCreateState);
router.post('/pitches/create', authorize, createPitchRequest)

export default router;
