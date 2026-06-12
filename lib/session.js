import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_COOKIE = 'bank_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'bank_platform_secure_session_secret_32_chars';

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SESSION_SECRET.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SESSION_SECRET.padEnd(32).slice(0, 32)), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE);
    if (!cookie) return null;
    
    const decrypted = decrypt(cookie.value);
    if (!decrypted) return null;
    
    try {
        return JSON.parse(decrypted);
    } catch (e) {
        return null;
    }
}

export async function setSession(data) {
    const cookieStore = await cookies();
    const encrypted = encrypt(JSON.stringify(data));
    cookieStore.set(SESSION_COOKIE, encrypted, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/'
    });
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}
