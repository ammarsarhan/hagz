import { Router, Request, Response } from "express";
import { handleFetchPayment, handleProcessPayment } from "../controllers/paymentController";
import { authorizePaymentOwnership, authorizePaymentValidity, authorizeUserAccessToken, authorizeVerificationStatus } from "../middleware/authorize";

const payment = Router();

payment.get("/:payment", authorizeUserAccessToken, authorizeVerificationStatus, authorizePaymentOwnership, authorizePaymentValidity, (req: Request, res: Response) => handleFetchPayment(req, res));
payment.post('/:payment/pay', authorizeUserAccessToken, authorizeVerificationStatus, authorizePaymentOwnership, authorizePaymentValidity, (req: Request, res: Response) => handleProcessPayment(req, res));

export default payment;