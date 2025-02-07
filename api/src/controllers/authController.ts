import { Request, Response } from "express";
import { signUpUserWithCredentials } from "../services/authService";

export async function signUpUser(req: Request, res: Response) {
    try {
        const { name, email, password } = req.body;
        await signUpUserWithCredentials(name, email, password);
        res.status(200).json({message: "Successfully created new user account!"});
    } catch (error: any) {
        res.status(400).json({message: error.message});
    }
}