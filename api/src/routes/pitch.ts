import { Router } from "express";
import { authorizeVerificationStatus, authorizeOwnerAccessToken } from "../middleware/authorize";
import { handleCreatePitchRequest, handleGetPitches, handleFetchPitch, handleSearchPitches, handleQueryPitches, handleUpdatePitch } from "../controllers/pitchController";
import { handleFetchReservation } from "../controllers/reservationController";

const pitch = Router();

pitch.get('/get', async (req, res) => handleGetPitches(req, res));
pitch.get('/search', async (req, res) => handleSearchPitches(req, res));
pitch.get("/query", async (req, res) => handleQueryPitches(req, res));
pitch.post('/create', authorizeOwnerAccessToken, authorizeVerificationStatus, async (req, res) => handleCreatePitchRequest(req, res));
pitch.patch('/:pitch/update/:field', authorizeOwnerAccessToken, authorizeVerificationStatus, async (req, res) => handleUpdatePitch(req, res));
pitch.get('/:pitch', async (req, res) => handleFetchPitch(req, res));
pitch.get('/:pitch/reservations/:reservation', authorizeOwnerAccessToken, authorizeVerificationStatus, async (req, res) => handleFetchReservation(req, res));

export default pitch;