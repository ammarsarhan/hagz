import 'dotenv/config';

import express from 'express';
import cors from "cors";

import auth from '@/domains/auth/auth.routes';
import dashboard from '@/domains/dashboard/dashboard.routes';

import sendError from '@/shared/middleware/error.middleware';
import cookieParser from 'cookie-parser';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use(cookieParser())
app.use(express.json());

app.use('/auth', auth);
app.use('/dashboard', dashboard);

app.use(sendError);

app.listen(port, () => {
    console.log(`Server has started running at http://localhost:${port}`);
});
