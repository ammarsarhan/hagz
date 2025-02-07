import { Router } from "express";
import { signInUser, signUpUser } from "../controllers/authController";

const auth = Router();

auth.post('/user/sign-in', (req, res) => signInUser(req, res));
auth.post('/user/sign-up', (req, res) => signUpUser(req, res));

auth.post('/owner/sign-up', (req, res) => {
    res.send('Owner sign up');
});

auth.post('/owner/sign-up', (req, res) => {
    res.send('Owner sign up');
});

auth.post('/sign-out', (req, res) => {
    res.send('Joint sign out');
});

export default auth;