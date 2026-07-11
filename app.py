"""app.py — AryallehPay entry point (Flask + Telegram bot)"""
import os
import secrets
from flask import Flask, redirect, url_for
from models import init_db
from bot_runner import start_bot


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))

    from api.routes import api_bp
    from panel.routes import panel_bp
    from pay.routes import pay_bp
    app.register_blueprint(api_bp)
    app.register_blueprint(panel_bp)
    app.register_blueprint(pay_bp)

    @app.get("/")
    def index():
        return redirect(url_for("panel.dashboard"))

    return app


if __name__ == "__main__":
    init_db()
    start_bot()          # بات توی thread جداگانه استارت میشه
    app = create_app()
    app.run(host="0.0.0.0", port=5050, debug=False)
