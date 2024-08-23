const bcrypt = require('bcryptjs');

export default async function HashPassword (password: string) {
    const salt = await bcrypt.genSalt(10);
    // Hash the password with the salt
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
}