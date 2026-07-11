"""api/routes.py — REST API endpoints for external services"""
import httpx
from flask import Blueprint, request, jsonify, current_app
from models import (
    get_service_by_token, create_pending_payment,
    find_matching_payment, mark_payment_matched,
    log_sms, create_transaction, update_callback_status,
    get_pending_payments, manual_confirm_payment
)
from sms_parser import parse_sms

api_bp = Blueprint("api", __name__, url_prefix="/api")


def auth_service(req):
    """Extract and validate Bearer token → service dict or None."""
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    return get_service_by_token(token)


# ── 1. Create payment request ──────────────────────────────────────────────────
@api_bp.post("/payment/create")
def payment_create():
    """
    POST /api/payment/create
    Headers: Authorization: Bearer <token>
    Body: { "order_id": "...", "amount_rials": 500000, "description": "...", "expires_minutes": 60 }
    Response: { "ok": true, "payment_id": 1, "expires_at": "..." }
    """
    svc = auth_service(request)
    if not svc:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    order_id      = data.get("order_id")
    amount_rials  = data.get("amount_rials")
    description   = data.get("description", "")
    expires_mins  = int(data.get("expires_minutes", 60))

    if not order_id or not amount_rials:
        return jsonify({"ok": False, "error": "order_id and amount_rials are required"}), 400

    try:
        amount_rials = int(amount_rials)
        redirect_url = data.get("redirect_url", "")

        # چک یکتایی مبلغ
        from models import is_amount_pending
        if is_amount_pending(amount_rials):
            return jsonify({
                "ok": False,
                "error": "amount_conflict",
                "message": f"مبلغ {amount_rials:,} ریال در حال حاضر روی یه سفارش دیگه pending است. چند ریال تفاوت بده تا یکتا بشه."
            }), 409

        result = create_pending_payment(svc["id"], order_id, amount_rials, description, expires_mins, redirect_url)
        pay_url = f"/pay/{result['pay_token']}"
        return jsonify({"ok": True, **result, "pay_url": pay_url})
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 409
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ── 2. Check payment status ────────────────────────────────────────────────────
@api_bp.get("/payment/status/<order_id>")
def payment_status(order_id: str):
    """
    GET /api/payment/status/<order_id>
    Headers: Authorization: Bearer <token>
    Response: { "ok": true, "status": "pending|matched|expired|cancelled", ... }
    """
    svc = auth_service(request)
    if not svc:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    payments = get_pending_payments(svc["id"])
    payment  = next((p for p in payments if p["order_id"] == order_id), None)
    if not payment:
        return jsonify({"ok": False, "error": "Not found"}), 404

    return jsonify({"ok": True, "status": payment["status"],
                    "amount_rials": payment["amount_rials"],
                    "created_at": payment["created_at"],
                    "expires_at": payment["expires_at"]})


# ── 3. Receive SMS (from Telegram bot or any source) ──────────────────────────
@api_bp.post("/sms/receive")
def sms_receive():
    data    = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"ok": False, "error": "message is required"}), 400

    # Parse SMS
    amount, paid_at = parse_sms(message)
    if amount is None:
        sms_id = log_sms(message, None, None, "failed", None)
        return jsonify({"ok": True, "parsed": False, "sms_id": sms_id})

    # Find matching payment
    payment = find_matching_payment(amount)
    if not payment:
        sms_id = log_sms(message, amount, paid_at, "ok", None)
        return jsonify({"ok": True, "parsed": True, "matched": False,
                        "amount_rials": amount, "sms_id": sms_id})

    # Mark matched
    mark_payment_matched(payment["id"])
    sms_id = log_sms(message, amount, paid_at, "ok", payment["id"])
    tx_id  = create_transaction(payment, sms_id, paid_at)

    # Fire callback async
    if payment.get("callback_url"):
        _fire_callback(tx_id, payment, paid_at)

    return jsonify({
        "ok": True, "parsed": True, "matched": True,
        "amount_rials": amount, "order_id": payment["order_id"],
        "service": payment["service_name"], "tx_id": tx_id
    })


def _fire_callback(tx_id: int, payment: dict, paid_at: str):
    """Fire HTTP callback to the service (sync with httpx for simplicity)."""
    payload = {
        "event":        "payment.confirmed",
        "order_id":     payment["order_id"],
        "amount_rials": payment["amount_rials"],
        "paid_at":      paid_at,
        "tx_id":        tx_id,
    }
    try:
        resp = httpx.post(payment["callback_url"], json=payload, timeout=10)
        update_callback_status(tx_id, "success", resp.text[:500])
    except Exception as e:
        update_callback_status(tx_id, "failed", str(e)[:500])


# ── 4. Manual confirm ─────────────────────────────────────────────────────────
@api_bp.post("/payment/manual-confirm")
def payment_manual_confirm():
    """
    POST /api/payment/manual-confirm
    Authorization: Bearer <service_token>
    Body: { "payment_id": 5, "note": "..." }
    """
    svc = auth_service(request)
    if not svc:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    data       = request.get_json(silent=True) or {}
    payment_id = data.get("payment_id")
    note       = data.get("note", "")

    if not payment_id:
        return jsonify({"ok": False, "error": "payment_id required"}), 400

    try:
        result  = manual_confirm_payment(int(payment_id), note)
        payment = result["payment"]
        tx_id   = result["tx_id"]
        if payment.get("callback_url"):
            _fire_callback(tx_id, payment, result["paid_at"])
        return jsonify({"ok": True, "tx_id": tx_id,
                        "order_id": payment["order_id"],
                        "paid_at": result["paid_at"]})
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 409


# ── 5. List payments ───────────────────────────────────────────────────────────
@api_bp.get("/payments/list")
def payments_list():
    """
    GET /api/payments/list
    Authorization: Bearer <service_token>
    """
    svc = auth_service(request)
    if not svc:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    payments = get_pending_payments(svc["id"])
    return jsonify({"ok": True, "payments": payments})


# ── 6. Poll payment status (for customer payment page) ────────────────────────
@api_bp.get("/pay/poll/<pay_token>")
def pay_poll(pay_token: str):
    """بدون احراز هویت — مشتری هر ۵ ثانیه صدا می‌زنه"""
    from models import get_payment_by_token
    payment = get_payment_by_token(pay_token)
    if not payment:
        return jsonify({"ok": False, "error": "not found"}), 404
    return jsonify({
        "ok":          True,
        "status":      payment["status"],
        "redirect_url": payment.get("redirect_url", ""),
    })
