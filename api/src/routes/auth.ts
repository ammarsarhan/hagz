import { Router } from "express";
import { signInUser, signUpUser, verifyUser, sendUserVerificationEmail } from "../controllers/authController";
// import { authorizeUserAccessToken } from "../middleware/authorize";

const auth = Router();

auth.post('/user/sign-in', (req, res) => signInUser(req, res));
auth.post('/user/sign-up', (req, res) => signUpUser(req, res));
auth.get('/user/verify', (req, res) => verifyUser(req, res));
auth.post('/user/verify/send', (req, res) => sendUserVerificationEmail(req, res));

auth.post('/owner/sign-in', (req, res) => {
    res.send('Owner sign in');
});

auth.post('/owner/sign-up', (req, res) => {
    res.send('Owner sign up');
});

auth.post('/sign-out', (req, res) => {
    res.send('Joint sign out');
});

export default auth;