import { Router, Request, Response } from "express";
import { handleFetchOwner } from "../controllers/ownerController"
import { authorizeOwnerAccessToken } from "../middleware/authorize";

const owner = Router();

owner.get("/", authorizeOwnerAccessToken, (req: Request, res: Response) => handleFetchOwner(req, res));

export default owner;