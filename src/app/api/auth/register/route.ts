import { NextApiRequest, NextApiResponse } from 'next'
 
export async function GET (req: NextApiRequest, res: NextApiResponse) {
    return new Response(JSON.stringify({ message: "Created user successfully!" }), {
        headers: { "Content-Type": "application/json" },
    });
}