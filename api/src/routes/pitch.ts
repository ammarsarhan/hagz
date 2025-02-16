import { Router } from "express";
import { authorizeVerificationStatus, authorizeOwnerAccessToken } from "../middleware/authorize";
import { handleCreatePitchRequest, handleFetchPitch, handleFetchPitches, handleUpdatePitch } from "../controllers/pitchController";

const pitch = Router();

pitch.get("/", async (req, res) => handleFetchPitches(req, res));
pitch.get('/:id', async (req, res) => handleFetchPitch(req, res));
pitch.patch('/:id/update/:field', async (req, res) => handleUpdatePitch(req, res));
pitch.post('/create', authorizeOwnerAccessToken, authorizeVerificationStatus, async (req, res) => handleCreatePitchRequest(req, res));

export default pitch;