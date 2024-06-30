import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
const bcrypt = require('bcryptjs');

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function Capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  return hashed;
}
