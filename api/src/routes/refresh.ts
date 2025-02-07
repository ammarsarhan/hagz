import { Router } from "express";
import { verify } from "jsonwebtoken";
import { generateAccessToken } from "../utils/token";

const refresh = Router();

refresh.post('/user', (req, res) => {
    const refreshToken = req.signedCookies.refreshToken;

    if (!refreshToken) {
        res.status(400).json({message: "No refresh token provided. Unable to create new access token."});
    }

    verify(refreshToken, process.env.REFRESH_SECRET_KEY || "", (error: any, user: any) => {
        if (error) {
            return res.status(406).json({message: "Invalid refresh token."});
        }

        const accessToken = generateAccessToken({id: user.id});
        return res.status(200).json({accessToken});
    });
});

export default refresh;