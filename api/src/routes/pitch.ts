import { Router } from "express";
import { handleFetchPitches, handleCreatePitch, handleGetPitch } from "../controllers/pitchController";
import { handleCreateGround, handleGetGround, handleFetchGrounds } from "../controllers/groundController";
import { authorizeOwnerAccessToken, authorizeVerificationStatus } from "../middleware/authorize";

const pitch = Router();

pitch.get("/", async (req, res) => handleFetchPitches(req, res));

pitch.post("/create", authorizeOwnerAccessToken, authorizeVerificationStatus, async (req, res) => handleCreatePitch(req, res));
pitch.get("/:pitch", async (req, res) => handleGetPitch(req, res));

pitch.post("/:pitch/ground/create", authorizeOwnerAccessToken, authorizeVerificationStatus, async (req, res) => handleCreateGround(req, res));
pitch.get("/:pitch/ground/:ground", async (req, res) => handleGetGround(req, res));
pitch.get("/:pitch/grounds", async (req, res) => handleFetchGrounds(req, res));

export default pitch;