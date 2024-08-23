import { createUserWithCredentials } from "@/app/utils/auth/main";

export async function POST (req: Request, res: Response) {
    const {firstName, lastName, email, password} = await req.json();
    const status = await createUserWithCredentials(firstName, lastName, email, password);
    return status;
}