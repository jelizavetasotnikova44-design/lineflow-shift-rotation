"""Lineflow web server with shared PostgreSQL state for Render."""

from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import base64
import hmac
import json
import os
import threading

import psycopg
from psycopg.types.json import Jsonb


ROOT = Path(__file__).resolve().parent
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "10000"))
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
STATE_KEY = "shared"
MAX_BODY_BYTES = 4 * 1024 * 1024
SCHEMA_READY = False
SCHEMA_LOCK = threading.Lock()


def configured_users():
    users = {}
    shared_password = os.environ.get("APP_PASSWORD", "").strip()
    if shared_password:
        users["lineflow"] = shared_password
    raw_users = os.environ.get("APP_USERS", "").strip()
    if raw_users:
        try:
            parsed = json.loads(raw_users)
            if isinstance(parsed, dict):
                users.update(
                    {
                        str(name): str(password)
                        for name, password in parsed.items()
                        if str(name).strip() and str(password)
                    }
                )
        except (TypeError, ValueError, json.JSONDecodeError):
            print("APP_USERS must be a JSON object of username/password pairs")
    return users


@contextmanager
def connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    with psycopg.connect(DATABASE_URL) as conn:
        ensure_schema(conn)
        yield conn


def ensure_schema(conn):
    global SCHEMA_READY
    if SCHEMA_READY:
        return
    with SCHEMA_LOCK:
        if SCHEMA_READY:
            return
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS lineflow_state (
                    state_key TEXT PRIMARY KEY,
                    version BIGINT NOT NULL,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_by TEXT NOT NULL
                )
                """
            )
        conn.commit()
        SCHEMA_READY = True


def read_state(conn):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT version, data, updated_at, updated_by FROM lineflow_state WHERE state_key = %s",
            (STATE_KEY,),
        )
        row = cursor.fetchone()
    if not row:
        return {"version": 0, "data": None, "updatedAt": None, "updatedBy": None}
    return {
        "version": row[0],
        "data": row[1],
        "updatedAt": row[2].isoformat(),
        "updatedBy": row[3],
    }


def write_state(conn, expected_version, data, username):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT version, data, updated_at, updated_by FROM lineflow_state WHERE state_key = %s FOR UPDATE",
            (STATE_KEY,),
        )
        row = cursor.fetchone()
        current_version = row[0] if row else 0
        if expected_version != current_version:
            conn.rollback()
            if not row:
                return False, {"version": 0, "data": None, "updatedAt": None, "updatedBy": None}
            return False, {
                "version": row[0],
                "data": row[1],
                "updatedAt": row[2].isoformat(),
                "updatedBy": row[3],
            }
        next_version = current_version + 1
        cursor.execute(
            """
            INSERT INTO lineflow_state (state_key, version, data, updated_by)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (state_key) DO UPDATE SET
                version = EXCLUDED.version,
                data = EXCLUDED.data,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
            RETURNING updated_at
            """,
            (STATE_KEY, next_version, Jsonb(data), username),
        )
        updated_at = cursor.fetchone()[0]
    conn.commit()
    return True, {
        "version": next_version,
        "updatedAt": updated_at.isoformat(),
        "updatedBy": username,
    }


class Handler(SimpleHTTPRequestHandler):
    server_version = "Lineflow/1.0"

    def __init__(self, *args, **kwargs):
        self.current_user = None
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            try:
                with connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("SELECT 1")
                        cursor.fetchone()
                self.send_json(200, {"ok": True, "database": True})
            except Exception as exc:
                print(f"Health check failed: {exc}")
                self.send_json(503, {"ok": False, "database": False})
            return
        if not self.authorized():
            return
        if path == "/api/state":
            try:
                with connection() as conn:
                    self.send_json(200, read_state(conn))
            except Exception as exc:
                print(f"Read failed: {exc}")
                self.send_json(503, {"error": "Shared database is unavailable."})
            return
        super().do_GET()

    def do_PUT(self):
        if not self.authorized():
            return
        if urlparse(self.path).path != "/api/state":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            payload = self.read_json()
            data = payload.get("data")
            version = payload.get("version")
            if not isinstance(data, dict) or not isinstance(version, int):
                self.send_json(400, {"error": "Invalid state payload."})
                return
            with connection() as conn:
                saved, result = write_state(conn, version, data, self.current_user)
            self.send_json(200 if saved else 409, result)
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:
            print(f"Write failed: {exc}")
            self.send_json(503, {"error": "Shared database is unavailable."})

    def authorized(self):
        users = configured_users()
        if not users:
            self.send_json(503, {"error": "No Lineflow users are configured."})
            return False
        header = self.headers.get("Authorization", "")
        try:
            scheme, encoded = header.split(" ", 1)
            if scheme.lower() != "basic":
                raise ValueError
            username, password = base64.b64decode(encoded).decode("utf-8").split(":", 1)
        except (ValueError, UnicodeDecodeError):
            return self.require_login()
        expected = users.get(username)
        if expected is None or not hmac.compare_digest(expected, password):
            return self.require_login()
        self.current_user = username
        return True

    def require_login(self):
        body = b"Authentication required"
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Lineflow", charset="UTF-8"')
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return False

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Invalid Content-Length") from exc
        if length <= 0 or length > MAX_BODY_BYTES:
            raise ValueError("Request body is empty or too large")
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Invalid JSON") from exc

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Lineflow listening on {HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

