import { Router } from "express";
import { 
    signInUser, 
    signInOwner, 
    signUpUser, 
    signUpOwner, 
    verifyUser, 
    sendUserVerificationEmail,
    sendOwnerVerificationEmail,
    verifyOwner,
    signOut
} from "../controllers/authController";
// import { authorizeUserAccessToken, authorizeOwnerAccessToken} from "../middleware/authorize";

const auth = Router();

auth.post('/user/sign-in', (req, res) => signInUser(req, res));
auth.post('/user/sign-up', (req, res) => signUpUser(req, res));
auth.get('/user/verify', (req, res) => verifyUser(req, res));
auth.post('/user/verify/send', (req, res) => sendUserVerificationEmail(req, res));

auth.post('/owner/sign-in', (req, res) => signInOwner(req, res));
auth.post('/owner/sign-up', (req, res) => signUpOwner(req, res));
auth.get('/owner/verify', (req, res) => verifyOwner(req, res));
auth.post('/owner/verify/send', (req, res) => sendOwnerVerificationEmail(req, res));

auth.post('/sign-out', (req, res) => signOut(req, res));

export default auth;