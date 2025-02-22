import { Router } from "express";
import { authorizeUserAccessToken, authorizeOwnerAccessToken, authorizeVerificationStatus } from "../middleware/authorize";
import { handleCreateUserReservation, handleCreateOwnerReservation } from "../controllers/reservationController";

const reservation = Router();

reservation.post("/user/create", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleCreateUserReservation(req, res));
reservation.post("/owner/create", authorizeOwnerAccessToken, authorizeVerificationStatus, (req, res) => handleCreateOwnerReservation(req, res));

export default reservation;