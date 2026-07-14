// lib/telegram.js — thin wrapper around the Telegram Bot HTTP API

function apiBase(botToken) {
    return `https://api.telegram.org/bot${botToken}`;
}

export async function tgCall(botToken, method, payload) {
    const resp = await fetch(`${apiBase(botToken)}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return await resp.json().catch(() => ({ ok: false }));
}

// parseMode: pass null/false to send as plain text — needed for forwarding
// arbitrary raw SMS content, which often contains unbalanced Markdown
// special characters (*, _, [, `) that make Telegram reject the message.
export async function sendMessage(botToken, chatId, text, replyMarkup = null, parseMode = "Markdown") {
    return tgCall(botToken, "sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: parseMode || undefined,
        reply_markup: replyMarkup || undefined,
    });
}

export async function editMessageText(botToken, chatId, messageId, text) {
    return tgCall(botToken, "editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "Markdown",
    });
}

export async function answerCallbackQuery(botToken, callbackQueryId, text = "") {
    return tgCall(botToken, "answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function setWebhook(botToken, url, secretToken) {
    return tgCall(botToken, "setWebhook", { url, secret_token: secretToken });
}

export function confirmKeyboard(paymentId, orderId) {
    return {
        inline_keyboard: [[
            { text: "✅ تأیید دستی", callback_data: `confirm:${paymentId}:${orderId}` },
        ]],
    };
}
