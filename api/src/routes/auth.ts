import { signUpUser } from "../controllers/authController";
import { Router } from "express";

const auth = Router();

auth.post('/user/sign-in', (req, res) => {
    res.send('User sign in');
});

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