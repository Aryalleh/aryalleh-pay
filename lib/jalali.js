// lib/jalali.js — Jalali (Persian) → Gregorian calendar conversion.
// Standard proleptic algorithm (Borkowski / jalaali), used only to render a
// human-readable paid_at for bank SMS timestamps. Never throws — falls back
// to "now" on any unexpected input, matching how paid_at is just informational.

function div(a, b) {
    return Math.floor(a / b);
}

function jalCal(jy) {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    const gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    let jump = 0;
    let i = 1;
    for (; i < breaks.length; i++) {
        const jm = breaks[i];
        jump = jm - jp;
        if (jy < jm) break;
        leapJ += div(jump, 33) * 8 + div(jump % 33, 4);
        jp = jm;
    }
    let n = jy - jp;
    leapJ += div(n, 33) * 8 + div(((n % 33) + 3), 4);
    if (jump % 33 === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = (((n + 1) % 33) - 1) % 4;
    if (leap === -1) leap = 4;
    return { leap, gy, march };
}

function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
        + div(153 * ((gm + 9) % 12) + 2, 5)
        + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
}

function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(j % 1461, 4) * 5 + 308;
    const gd = div(i % 153, 5) + 1;
    const gm = (div(i, 153) % 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

/** '1404.08.13 17:52' → '2025-10-.. 17:52:00' (SQLite datetime string) */
export function jalaliStringToGregorian(jalaliStr) {
    try {
        const [datePart, timePart] = jalaliStr.split(" ");
        const [y, m, d] = datePart.split(".").map((x) => parseInt(x, 10));
        const [hh, mm] = (timePart || "00:00").split(":").map((x) => parseInt(x, 10));
        const jdn = j2d(y, m, d);
        const { gy, gm, gd } = d2g(jdn);
        return `${gy}-${pad2(gm)}-${pad2(gd)} ${pad2(hh)}:${pad2(mm)}:00`;
    } catch {
        return nowString();
    }
}

export function nowString() {
    const d = new Date();
    return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Current Jalali year, used when an SMS only gives month/day (no year). */
export function currentJalaliYear() {
    try {
        const now = new Date();
        // Approximate: Gregorian → Jalali needs the inverse conversion; instead
        // derive by converting Jan 1 of a nearby Jalali year and comparing.
        // Simple robust approach: binary-search-free estimate then correct.
        let jy = now.getUTCFullYear() - 621;
        for (let tries = 0; tries < 3; tries++) {
            const r = jalCal(jy);
            const marchFirstJdn = g2d(r.gy, 3, r.march);
            const todayJdn = g2d(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
            if (todayJdn < marchFirstJdn) { jy -= 1; continue; }
            const nextR = jalCal(jy + 1);
            const nextMarchFirstJdn = g2d(nextR.gy, 3, nextR.march);
            if (todayJdn >= nextMarchFirstJdn) { jy += 1; continue; }
            break;
        }
        return jy;
    } catch {
        return new Date().getUTCFullYear() - 621;
    }
}
