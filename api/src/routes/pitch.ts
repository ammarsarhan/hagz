import { Router } from "express";
import { handleCreatePitch, handleGetPitch } from "../controllers/pitchController";
import { authorizeOwnerAccessToken, authorizeVerificationStatus } from "../middleware/authorize";

const pitch = Router();

pitch.post("/create", authorizeOwnerAccessToken, authorizeVerificationStatus, async (req, res) => handleCreatePitch(req, res))
pitch.get("/:pitch", async (req, res) => handleGetPitch(req, res));

export default pitch;