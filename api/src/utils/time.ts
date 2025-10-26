export function getResendLeft(sentAt: Date, cooldown: number = 180) {
    const now = new Date();
    const lastSent = (now.getTime() - new Date(sentAt).getTime()) / 1000;
    const remaining = Math.max(cooldown - lastSent, 0);
    
    return Math.ceil(remaining);
}