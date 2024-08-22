export async function GET (req: Request, res: Response) {
    return new Response(JSON.stringify({ message: "Signed user in successfully!" }), {
        headers: { "Content-Type": "application/json" },
    });
}