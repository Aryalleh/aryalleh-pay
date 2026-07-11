// lib/sms_parser.js — Parse Iranian bank SMS messages into (amountRials, paidAt).
// Supports: بلو, ResalatBank, خاورمیانه — ported from the original Python parser.
import { jalaliStringToGregorian, nowString, currentJalaliYear } from "./jalali.js";

function normalizeDigits(text) {
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    let out = text;
    for (let i = 0; i < 10; i++) {
        out = out.split(persian[i]).join(String(i));
        out = out.split(arabic[i]).join(String(i));
    }
    return out;
}

/**
 * @param {string} message
 * @returns {{amount: number|null, paidAt: string|null}}
 */
export function parseSms(message) {
    let text = message.replace(/%2B/g, "+");
    text = normalizeDigits(text.trim());

    // ── بانک بلو ──────────────────────────────────────────────────────────
    if ((text.includes("بلو") || text.includes("واریز پول")) &&
        /ریال\s*به حساب شما نشست/.test(text)) {
        const priceM = text.match(/([\d,]+)\s*ریال\s*به حساب شما نشست/);
        const dateM = text.match(/(\d{4}\.\d{2}\.\d{2})/);
        const timeM = text.match(/(\d{1,2}:\d{2})/);
        if (priceM && dateM) {
            const amount = parseInt(priceM[1].replace(/,/g, ""), 10);
            const timeStr = timeM ? timeM[1] : "00:00";
            const paidAt = jalaliStringToGregorian(`${dateM[1]} ${timeStr}`);
            return { amount, paidAt };
        }
    }

    // ── ResalatBank ───────────────────────────────────────────────────────
    else if (text.includes("ResalatBank")) {
        const priceM = text.match(/\+?([\d,]{5,})/);
        const dtM = text.match(/(\d{2})\/(\d{2})_(\d{2}:\d{2})/);
        if (priceM && dtM) {
            const amount = parseInt(priceM[1].replace(/,/g, ""), 10);
            const year = currentJalaliYear();
            const month = parseInt(dtM[1], 10);
            const day = parseInt(dtM[2], 10);
            const timeStr = dtM[3];
            const paidAt = jalaliStringToGregorian(
                `${String(year).padStart(4, "0")}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} ${timeStr}`
            );
            return { amount, paidAt };
        }
    }

    // ── بانک خاورمیانه ────────────────────────────────────────────────────
    else if (text.includes("خاورمیانه")) {
        if (!/واریز/.test(text)) return { amount: null, paidAt: null };
        let priceM = text.match(/\+(\d{1,2},\d{3},\d{3,})/);
        if (!priceM) priceM = text.match(/\+(\d[\d,]{5,})/);
        const dateM = text.match(/(\d{2})\/(\d{2})/);
        const timeM = text.match(/(\d{1,2}:\d{2})/);
        if (priceM && dateM) {
            const amount = parseInt(priceM[1].replace(/,/g, ""), 10);
            const year = currentJalaliYear();
            const month = parseInt(dateM[1], 10);
            const day = parseInt(dateM[2], 10);
            const timeStr = timeM ? timeM[1] : "00:00";
            const paidAt = jalaliStringToGregorian(
                `${String(year).padStart(4, "0")}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} ${timeStr}`
            );
            return { amount, paidAt };
        }
    }

    return { amount: null, paidAt: null };
}

export { nowString };
