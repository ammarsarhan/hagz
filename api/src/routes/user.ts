import { Router, Request, Response } from "express";
import { handleFetchUser } from "../controllers/userController"
import { authorizeUserAccessToken } from "../middleware/authorize";

const payment = Router();

payment.get("/", authorizeUserAccessToken, (req: Request, res: Response) => handleFetchUser(req, res));

export default payment;