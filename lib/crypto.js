// lib/crypto.js — password hashing & token generation using Web Crypto (Workers runtime)

const PBKDF2_ITERATIONS = 100000;

function toHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

async function deriveBits(password, salt, iterations) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256
    );
    return toHex(new Uint8Array(bits));
}

export async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hashHex = await deriveBits(password, salt, PBKDF2_ITERATIONS);
    return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hashHex}`;
}

export async function verifyPassword(password, stored) {
    if (!stored) return false;
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    const salt = fromHex(parts[2]);
    const candidateHex = await deriveBits(password, salt, iterations);
    return timingSafeEqual(candidateHex, parts[3]);
}

export function randomToken(prefix = "", bytes = 24) {
    const buf = crypto.getRandomValues(new Uint8Array(bytes));
    return prefix + toHex(buf);
}

export function randomUrlSafeToken(bytes = 24) {
    const buf = crypto.getRandomValues(new Uint8Array(bytes));
    let str = "";
    for (const b of buf) str += String.fromCharCode(b);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
