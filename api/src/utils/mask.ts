export function maskEmail(email: string) {
    const masked = email.replace(/(?<=.{3}).(?=[^@]*?@)/g, "*");
    return masked;
}

export function maskPhone(phone: string) {
    const masked = phone.replace(/(\d{4}-\d{3})-\d{4}/, "$1-****");
    return masked;
}