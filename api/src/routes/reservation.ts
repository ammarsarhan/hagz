import { Router } from "express";
import { authorizeUserAccessToken, authorizeOwnerAccessToken, authorizeVerificationStatus } from "../middleware/authorize";
import { handleUserCreateReservation, handleOwnerCreateReservation } from "../controllers/reservationController";

const reservation = Router();

reservation.post("/user/create", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleUserCreateReservation(req, res));
reservation.post("/owner/create", authorizeOwnerAccessToken, authorizeVerificationStatus, (req, res) => handleOwnerCreateReservation(req, res));

export default reservation;