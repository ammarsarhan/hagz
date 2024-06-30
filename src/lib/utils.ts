import { type ClassValue, clsx } from "clsx"
// import { hash } from 'argon2'
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add options
export async function hashPassword(password: string) {
  return await password;
}
