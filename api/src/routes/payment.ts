import { Router, Request, Response } from "express";
import { handleFetchPayment } from "../controllers/paymentController";
import { authorizePaymentOwnership, authorizeUserAccessToken, authorizeVerificationStatus } from "../middleware/authorize";

const payment = Router();

payment.get("/:payment", authorizeUserAccessToken, authorizeVerificationStatus, authorizePaymentOwnership, (req: Request, res: Response) => handleFetchPayment(req, res));

export default payment;