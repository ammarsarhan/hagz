import { twMerge } from "tailwind-merge";

const cn = (...classes: (string | undefined | false)[]) => twMerge(classes.filter(Boolean).join(' '));
export default cn;
