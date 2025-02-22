import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';

import auth from './routes/auth';
import refresh from './routes/refresh';
import pitch from './routes/pitch';
import reservation from './routes/reservation';

import cookieParser from 'cookie-parser';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use('/api/auth', auth);
app.use('/api/refresh', refresh);
app.use('/api/pitch', pitch);
app.use('/api/reservation', reservation);

app.listen(port, () => {
    console.log('The application is listening ' + 'on port http://localhost:' + port);
});