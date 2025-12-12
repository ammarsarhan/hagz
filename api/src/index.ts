import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import 'dotenv/config';

import auth from '@/routes/auth';
import dashboard from '@/routes/dashboard';
import pitch from '@/routes/pitch';
import invitation from '@/routes/invitation';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware setup to handle JSON requests, cookies, and CORS
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL,
  credentials: true              
}));

async function init() {
    // Handle any other crucial connections before the application starts
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
};

// Routing
app.use('/auth', auth);
app.use('/dashboard', dashboard);
app.use('/pitch', pitch)
app.use('/invitation', invitation);

// Start the server
init();
