import { Router } from "express";
import { authorizeVerificationStatus, authorizeOwnerAccessToken, authorizePitchOwnership } from "../middleware/authorize";
import { 
    handleCreatePitchRequest, 
    handleGetPitches, 
    handleFetchPitch, 
    handleSearchPitches, 
    handleQueryPitches, 
    handleUpdatePitch,
    handleFetchPitchSettings
} from "../controllers/pitchController";

import { 
    handleFetchAllReservations, 
    handleFetchScheduledReservations, 
    handleFetchReservation, 
    handleFetchDoneReservations,
    handleCreatePitchReservation
} from "../controllers/reservationController";

import { handleFetchPayment } from "../controllers/paymentController";

const pitch = Router();

pitch.get('/get', async (req, res) => handleGetPitches(req, res));
pitch.get('/search', async (req, res) => handleSearchPitches(req, res));
pitch.get("/query", async (req, res) => handleQueryPitches(req, res));
pitch.post('/create', authorizeOwnerAccessToken, authorizeVerificationStatus, async (req, res) => handleCreatePitchRequest(req, res));

pitch.get('/:pitch', async (req, res) => handleFetchPitch(req, res));

pitch.get('/:pitch/reservations/all', authorizeOwnerAccessToken, authorizeVerificationStatus, authorizePitchOwnership, async (req, res) => handleFetchAllReservations(req, res));
pitch.get('/:pitch/reservations/scheduled', authorizeOwnerAccessToken, authorizeVerificationStatus, authorizePitchOwnership, async (req, res) => handleFetchScheduledReservations(req, res));
pitch.get('/:pitch/reservations/done', authorizeOwnerAccessToken, authorizeVerificationStatus, authorizePitchOwnership, async (req, res) => handleFetchDoneReservations(req, res));
pitch.get('/:pitch/reservations/:reservation', authorizeOwnerAccessToken, authorizeVerificationStatus, authorizePitchOwnership, async (req, res) => handleFetchReservation(req, res));

pitch.get('/:pitch/settings', authorizeOwnerAccessToken, authorizeVerificationStatus, authorizePitchOwnership, async (req, res) => handleFetchPitchSettings(req, res));
pitch.patch('/:pitch/update/:field', authorizeOwnerAccessToken, authorizeVerificationStatus, authorizePitchOwnership, async (req, res) => handleUpdatePitch(req, res));
pitch.post('/:pitch/reservations/create', authorizeOwnerAccessToken, authorizeVerificationStatus, authorizePitchOwnership, async (req, res) => handleCreatePitchReservation(req, res));

pitch.get('/:pitch/payments/:payment', authorizeOwnerAccessToken, authorizeVerificationStatus, authorizePitchOwnership, async (req, res) => handleFetchPayment(req, res));

export default pitch;