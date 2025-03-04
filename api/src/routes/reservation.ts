import { Router } from "express";
import { authorizeReservationOwnership, authorizeUserAccessToken, authorizeVerificationStatus } from "../middleware/authorize";
import { 
    handleCreateUserReservation,
    handleFetchReservation, 
    handleFetchAllReservations,
    handleFetchScheduledReservations,
    handleFetchDoneReservations
} from "../controllers/reservationController";

const reservation = Router();

reservation.post("/create", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleCreateUserReservation(req, res));
reservation.get("/all", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleFetchAllReservations(req, res));
reservation.get("/scheduled", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleFetchScheduledReservations(req, res));
reservation.get("/done", authorizeUserAccessToken, authorizeVerificationStatus, (req, res) => handleFetchDoneReservations(req, res));

reservation.get("/:reservation", authorizeUserAccessToken, authorizeVerificationStatus, authorizeReservationOwnership, (req, res) => handleFetchReservation(req, res));

export default reservation;