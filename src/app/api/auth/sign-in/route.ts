import { NextApiRequest, NextApiResponse } from 'next'
 
export async function GET (req: NextApiRequest, res: NextApiResponse) {
    return new Response(JSON.stringify({ message: "Signed user in successfully!" }), {
        headers: { "Content-Type": "application/json" },
    });
}