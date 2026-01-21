import 'dotenv/config';

import express, { Request, Response } from 'express';
import cors from "cors";

import auth from '@/domains/auth/auth.routes';

import handleError from '@/shared/middleware/error.middleware';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());

app.get('/health', (_: Request, res: Response) => {
    return res.status(200).json({ status: 'UP' });
});

app.use('/auth', auth);
app.use(handleError);

app.listen(port, () => {
    console.log(`Server has started running at http://localhost:${port}`);
});
