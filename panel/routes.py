"""panel/routes.py — Web admin panel"""
import os
import secrets
from functools import wraps
from flask import (Blueprint, render_template, request, redirect,
                   url_for, session, flash, jsonify, current_app)
from models import (
    get_services, create_service, delete_service,
    toggle_service, regenerate_token,
    get_pending_payments, get_transactions, get_stats,
    manual_confirm_payment, update_callback_status,
    verify_admin_password, change_admin_password,
    get_bot_settings, save_bot_settings
)

panel_bp = Blueprint("panel", __name__, url_prefix="/panel")


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("panel.login"))
        return f(*args, **kwargs)
    return decorated


# ── Auth ───────────────────────────────────────────────────────────────────────

@panel_bp.get("/login")
def login():
    return render_template("login.html")


@panel_bp.post("/login")
def login_post():
    password = request.form.get("password", "")
    if verify_admin_password(password):
        session["admin_logged_in"] = True
        return redirect(url_for("panel.dashboard"))
    flash("رمز اشتباه است", "error")
    return render_template("login.html")


@panel_bp.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("panel.login"))


# ── Dashboard ──────────────────────────────────────────────────────────────────

@panel_bp.get("/")
@login_required
def dashboard():
    stats = get_stats()
    recent_tx = get_transactions(limit=10)
    return render_template("dashboard.html", stats=stats, transactions=recent_tx)


# ── Services ───────────────────────────────────────────────────────────────────

@panel_bp.get("/services")
@login_required
def services():
    svcs = get_services()
    return render_template("services.html", services=svcs)


@panel_bp.post("/services/create")
@login_required
def service_create():
    name         = request.form.get("name", "").strip()
    description  = request.form.get("description", "").strip()
    callback_url = request.form.get("callback_url", "").strip()
    if not name:
        flash("نام سرویس الزامی است", "error")
        return redirect(url_for("panel.services"))
    try:
        result = create_service(name, description, callback_url)
        flash(f"سرویس ساخته شد | توکن: {result['token']}", "token")
    except Exception as e:
        flash(f"خطا: {e}", "error")
    return redirect(url_for("panel.services"))


@panel_bp.post("/services/<int:sid>/toggle")
@login_required
def service_toggle(sid: int):
    svc_list = get_services()
    svc = next((s for s in svc_list if s["id"] == sid), None)
    if svc:
        toggle_service(sid, not bool(svc["is_active"]))
    return redirect(url_for("panel.services"))


@panel_bp.post("/services/<int:sid>/delete")
@login_required
def service_delete(sid: int):
    delete_service(sid)
    flash("سرویس حذف شد", "info")
    return redirect(url_for("panel.services"))


@panel_bp.post("/services/<int:sid>/regen-token")
@login_required
def service_regen_token(sid: int):
    new_token = regenerate_token(sid)
    flash(f"توکن جدید: {new_token}", "token")
    return redirect(url_for("panel.services"))


# ── Payments ───────────────────────────────────────────────────────────────────

@panel_bp.get("/payments")
@login_required
def payments():
    payments = get_pending_payments()
    return render_template("payments.html", payments=payments)


# ── Manual confirm ─────────────────────────────────────────────────────────────

@panel_bp.post("/payments/<int:pid>/confirm")
@login_required
def payment_manual_confirm(pid: int):
    note = request.form.get("note", "").strip()
    try:
        result = manual_confirm_payment(pid, note)
        payment = result["payment"]
        tx_id   = result["tx_id"]
        # fire callback if configured
        if payment.get("callback_url"):
            from api.routes import _fire_callback
            _fire_callback(tx_id, payment, result["paid_at"])
        flash(f"✅ پرداخت #{pid} (سفارش {payment['order_id']}) تأیید شد | تراکنش #{tx_id}", "info")
    except ValueError as e:
        flash(f"خطا: {e}", "error")
    return redirect(url_for("panel.payments"))


# ── Transactions ───────────────────────────────────────────────────────────────

@panel_bp.get("/transactions")
@login_required
def transactions():
    txs = get_transactions(limit=200)
    return render_template("transactions.html", transactions=txs)


# ── Settings ───────────────────────────────────────────────────────────────────

@panel_bp.get("/settings")
@login_required
def settings():
    bot = get_bot_settings()
    svcs = get_services()
    return render_template("settings.html", bot=bot, services=svcs)


@panel_bp.post("/settings/save-bot")
@login_required
def settings_save_bot():
    bot_token    = request.form.get("bot_token", "").strip()
    admin_chat_id = request.form.get("admin_chat_id", "").strip()
    service_token = request.form.get("service_token", "").strip()
    if not bot_token or not admin_chat_id or not service_token:
        flash("همه فیلدهای بات الزامی هستند", "error")
        return redirect(url_for("panel.settings"))
    save_bot_settings(bot_token, admin_chat_id, service_token)
    flash("تنظیمات بات ذخیره شد — بات ری‌استارت می‌شود", "info")
    # signal bot restart
    from bot_runner import restart_bot
    restart_bot()
    return redirect(url_for("panel.settings"))


@panel_bp.post("/settings/change-password")
@login_required
def change_password():
    current  = request.form.get("current_password", "")
    new_pw   = request.form.get("new_password", "")
    confirm  = request.form.get("confirm_password", "")
    if not verify_admin_password(current):
        flash("رمز فعلی اشتباه است", "error")
        return redirect(url_for("panel.settings"))
    if len(new_pw) < 6:
        flash("رمز جدید باید حداقل ۶ کاراکتر باشد", "error")
        return redirect(url_for("panel.settings"))
    if new_pw != confirm:
        flash("رمز جدید و تکرار آن یکسان نیستند", "error")
        return redirect(url_for("panel.settings"))
    change_admin_password(new_pw)
    session.clear()
    flash("رمز تغییر کرد — لطفاً دوباره وارد شوید", "info")
    return redirect(url_for("panel.login"))




# ── Cards ──────────────────────────────────────────────────────────────────────
from models import get_cards, create_card, delete_card, toggle_card

@panel_bp.get("/cards")
@login_required
def cards():
    return render_template("cards.html", cards=get_cards(active_only=False))

@panel_bp.post("/cards/create")
@login_required
def card_create():
    label       = request.form.get("label","").strip()
    card_number = request.form.get("card_number","").strip().replace("-","").replace(" ","")
    sheba       = request.form.get("sheba","").strip()
    owner_name  = request.form.get("owner_name","").strip()
    if not all([label, card_number, sheba, owner_name]):
        flash("همه فیلدها الزامی هستند", "error")
        return redirect(url_for("panel.cards"))
    create_card(label, card_number, sheba, owner_name)
    flash("کارت اضافه شد", "info")
    return redirect(url_for("panel.cards"))

@panel_bp.post("/cards/<int:cid>/delete")
@login_required
def card_delete(cid):
    delete_card(cid)
    return redirect(url_for("panel.cards"))

@panel_bp.post("/cards/<int:cid>/toggle")
@login_required
def card_toggle(cid):
    cards_list = get_cards(active_only=False)
    card = next((c for c in cards_list if c["id"] == cid), None)
    if card:
        toggle_card(cid, not bool(card["is_active"]))
    return redirect(url_for("panel.cards"))
