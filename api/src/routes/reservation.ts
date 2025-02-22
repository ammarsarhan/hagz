import { Router } from "express";
import { authorizeUserAccessToken, authorizeOwnerAccessToken, authorizeVerificationStatus } from "../middleware/authorize";
import { 
    handleCreateUserReservation, 
    handleCreateOwnerReservation, 
    handleFetchReservation, 
    handleFetchAllReservations,
    handleFetchScheduledReservations,
    handleFetchDoneReservations
 } from "../controllers/reservationController";

const reservation = Router();

reservation.post("/user/create", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleCreateUserReservation(req, res));
reservation.post("/owner/create", authorizeOwnerAccessToken, authorizeVerificationStatus, (req, res) => handleCreateOwnerReservation(req, res));

reservation.get("/all", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleFetchAllReservations(req, res));
reservation.get("/scheduled", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleFetchScheduledReservations(req, res));
reservation.get("/done", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleFetchDoneReservations(req, res));
reservation.get("/:reservation", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleFetchReservation(req, res));

export default reservation;