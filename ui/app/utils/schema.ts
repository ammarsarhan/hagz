import { ZodError } from "zod";

export default function parseErrors<T>(issues: ZodError<T>["issues"], prefix?: string) {
    const errors: Record<string, string> = {};

    issues.forEach((issue) => {
        let path = "";

        if (prefix) path += `${prefix}.`;
        path += issue.path.join(".")

        errors[path] = issue.message;
    });

    return errors;
}