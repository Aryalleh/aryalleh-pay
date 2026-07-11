// functions/panel/settings/save-bot.js — saves bot config and registers the
// Telegram webhook (replaces the old long-polling bot_runner.py thread, which
// can't run on Cloudflare Pages).
import { saveBotSettings } from "../../../lib/db.js";
import { randomToken } from "../../../lib/crypto.js";
import { setWebhook } from "../../../lib/telegram.js";
import { redirectWithFlash } from "../../../lib/session.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    const botToken = (form.get("bot_token") || "").trim();
    const adminChatId = (form.get("admin_chat_id") || "").trim();
    const serviceToken = (form.get("service_token") || "").trim();

    if (!botToken || !adminChatId || !serviceToken) {
        return redirectWithFlash("/panel/settings", "همه فیلدهای بات الزامی هستند", "error");
    }

    const webhookSecret = randomToken("whsec_", 24);
    await saveBotSettings(env, botToken, adminChatId, serviceToken, webhookSecret);

    const origin = new URL(request.url).origin;
    const result = await setWebhook(botToken, `${origin}/telegram/webhook`, webhookSecret);

    if (!result.ok) {
        return redirectWithFlash(
            "/panel/settings",
            `تنظیمات ذخیره شد اما ثبت Webhook ناموفق بود: ${result.description || "خطای نامشخص"}`,
            "error"
        );
    }
    return redirectWithFlash("/panel/settings", "تنظیمات بات ذخیره و Webhook ثبت شد", "info");
}
