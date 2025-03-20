import 'dotenv/config';
import express, { Request, Response } from 'express';

import auth from './routes/auth';
import user from './routes/user';
import refresh from './routes/refresh';
import pitch from './routes/pitch';
import reservation from './routes/reservation';
import payment from './routes/payment';

import cookieParser from 'cookie-parser';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: ["http://localhost:3001", "http://127.0.0.1:3001"],
    credentials: true
}));

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use('/api/auth', auth);
app.use('/api/user', user);
app.use('/api/refresh', refresh);
app.use('/api/pitch', pitch);
app.use('/api/reservation', reservation);
app.use('/api/payment', payment);

app.get('/debug', (req: Request, res: Response) => {
    console.log(req.cookies);
    console.log(req.signedCookies)
})

app.listen(port, () => {
    console.log('The application is listening ' + 'on port http://localhost:' + port);
});