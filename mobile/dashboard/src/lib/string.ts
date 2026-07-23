import * as z from "zod";

const trim = 
    (error: string) => z
        .string(error)
        .transform(s => s.trim());

export default trim;