import { Router, Request, Response } from "express";
import { handleFetchUser } from "../controllers/userController"
import { authorizeUserAccessToken } from "../middleware/authorize";

const user = Router();

user.get("/", authorizeUserAccessToken, (req: Request, res: Response) => handleFetchUser(req, res));

export default user;