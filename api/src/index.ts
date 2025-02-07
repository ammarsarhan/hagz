import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';

import auth from './routes/auth';

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/auth', auth);

app.listen(port, () => {
    console.log('The application is listening ' + 'on port http://localhost:' + port);
});