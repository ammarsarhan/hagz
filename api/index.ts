import express, { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    return res.status(200).json({ status: 'UP' });
});

app.listen(port, () => {
    console.log(`Server has started running at http://localhost:${port}`);
});
