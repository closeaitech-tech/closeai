"""
OS AI — Enterprise Backend v38.1 (Security Hardening — Founder Lock, Mandatory Verification, Optimised Auth, Nonce Fix, Content Moderation)
CLOSEAI Technologies — CEO Osinachi Chukwu
Every CLOSE operation is on‑chain. Real staking. Real burn. Real value.
"""
import os, re, json, uuid, time, hmac, hashlib, base64, secrets, requests, logging, bcrypt, threading, xml.etree.ElementTree as ET, string, asyncio
from typing import Optional, List, Tuple, Dict, Any
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import PyPDF2, docx, openpyxl
import psycopg2, psycopg2.pool
import uvicorn
import httpx
import resend
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Depends, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, EmailStr
from pydantic_settings import BaseSettings

from web3 import Web3
from eth_account import Account

# ================================================================================
# SETTINGS
# ================================================================================
class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    FOUNDER_KEY: str
    RESEND_API_KEY: str = ""
    FRONTEND_URL: str = "https://osai.io"
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    COINGECKO_KEY: str = ""
    SERPAPI_KEY: str = ""
    NEWS_API_KEY: str = ""
    FINNHUB_API_KEY: str = ""
    ETHERSCAN_API_KEY: str = ""
    POLYGONSCAN_API_KEY: str = ""
    ONEPINCH_API_KEY: str = ""
    COVALENT_API_KEY: str = ""
    FOUNDER_EXTRA_PROMPT: str = ""

    # Blockchain
    POLYGON_RPC_URL: str = "https://polygon-rpc.com"
    ETHEREUM_RPC_URL: str = "https://eth.llamarpc.com"
    BSC_RPC_URL: str = "https://bsc-dataseed.binance.org"
    ARBITRUM_RPC_URL: str = "https://arb1.arbitrum.io/rpc"
    BASE_RPC_URL: str = "https://mainnet.base.org"

    # CLOSE Token
    CLOSE_CONTRACT_ADDRESS: str
    CLOSE_TREASURY_ADDRESS: str
    CLOSE_HOT_WALLET: str
    CLOSE_STAKING_CONTRACT: str = ""
    TREASURY_PRIVATE_KEY: str = ""
    HOT_WALLET_PRIVATE_KEY: str = ""
    CLOSE_DECIMALS: int = 18
    CLOSE_TOTAL_SUPPLY: int = 800_000_000_000_000
    CLOSE_PRICE_USD: float = 0.00009776

    # Wallet Settings
    FREE_CLOSE_AMOUNT: int = 500
    MIN_PURCHASE_USD: float = 1.00
    BURN_PER_MESSAGE: int = 25
    FREE_MESSAGES_GUEST: int = 5
    STAKE_BUILDER: int = 4_000_000
    STAKE_PRO: int = 15_000_000
    STAKE_ENTERPRISE: int = 35_000_000
    WORKSPACE_JOIN_COST: int = 500

    # Distribution Wallet (Rabby wallet)
    DISTRIBUTION_WALLET_ADDRESS: str = ""
    DISTRIBUTION_WALLET_PRIVATE_KEY: str = ""

    # Additional market fallback
    POL_PRICE_USD: float = 0.5

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Initialize Resend
resend.api_key = settings.RESEND_API_KEY

app = FastAPI(title="OS AI API", version="38.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------------
# Security middleware – block malicious IPs and apply rate‑limiting
# --------------------------------------------------------------------------------
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    ip = request.client.host
    user_agent = request.headers.get("user-agent", "")

    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("SELECT 1 FROM blocked_ips WHERE ip_address=%s AND blocked_until > NOW()", (ip,))
            if c.fetchone():
                return Response(content="Access denied", status_code=403)

    if not check_rate_limit(ip, "global", limit=200):
        log_security_event("rate_limit_exceeded", ip, user_agent, "High request rate", "medium")
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("""INSERT INTO blocked_ips (ip_address, reason, blocked_until)
                             VALUES (%s,'Rate limit exceeded', %s)
                             ON CONFLICT (ip_address) DO UPDATE SET blocked_until = %s""",
                          (ip, now_utc() + timedelta(minutes=30), now_utc() + timedelta(minutes=30)))
                conn.commit()
        return Response(content="Temporarily blocked", status_code=429)

    response = await call_next(request)
    return response

# --------------------------------------------------------------------------------
# API‑key authentication middleware – optimised
# --------------------------------------------------------------------------------
@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("ApiKey "):
        return await call_next(request)

    key = auth[7:]
    prefix = key[:8] if len(key) >= 8 else key

    candidate = None
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("SELECT id, user_id, key_hash, scopes FROM api_keys WHERE prefix = %s AND is_active = TRUE",
                      (prefix,))
            rows = c.fetchall()
            for row in rows:
                if bcrypt.checkpw(key.encode(), row[2].encode()):
                    candidate = row
                    break
            if not candidate:
                return Response(content="Invalid API key", status_code=401)
            c.execute("UPDATE api_keys SET last_used = NOW() WHERE id = %s", (candidate[0],))
            conn.commit()

    request.state.api_user_id = candidate[1]
    request.state.api_scopes = candidate[3].split(',')

    response = await call_next(request)

    try:
        with get_db() as conn2:
            with conn2.cursor() as c2:
                c2.execute("INSERT INTO api_usage (id, user_id, api_key_id, endpoint) VALUES (%s,%s,%s,%s)",
                          (str(uuid.uuid4()), candidate[1], candidate[0], request.url.path))
                conn2.commit()
    except Exception as e:
        logger.error(f"API usage logging failed: {e}")

    return response

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# ================================================================================
# DATABASE POOL
# ================================================================================
db_pool = None
def get_db_pool():
    global db_pool
    if db_pool is None:
        db_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2, maxconn=20, dsn=settings.DATABASE_URL, connect_timeout=10
        )
    return db_pool

@contextmanager
def get_db():
    pool = get_db_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)

# ================================================================================
# WEB3 SETUP
# ================================================================================
w3_polygon = Web3(Web3.HTTPProvider(settings.POLYGON_RPC_URL))
try:
    from web3.middleware import geth_poa_middleware
    w3_polygon.middleware_onion.inject(geth_poa_middleware, layer=0)
except ImportError:
    pass

CHAINS = {
    "polygon": {
        "name": "Polygon",
        "rpc": settings.POLYGON_RPC_URL,
        "chain_id": 137,
        "symbol": "POL",
        "explorer": "https://polygonscan.com",
        "tokens": {
            "USDT": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
            "USDC": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
            "WETH": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
            "CLOSE": settings.CLOSE_CONTRACT_ADDRESS,
        }
    },
    "ethereum": {
        "name": "Ethereum",
        "rpc": settings.ETHEREUM_RPC_URL,
        "chain_id": 1,
        "symbol": "ETH",
        "explorer": "https://etherscan.io",
        "tokens": {
            "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        }
    },
    "bsc": {
        "name": "BSC",
        "rpc": settings.BSC_RPC_URL,
        "chain_id": 56,
        "symbol": "BNB",
        "explorer": "https://bscscan.com",
        "tokens": {
            "USDT": "0x55d398326f99059fF775485246999027B3197955",
            "USDC": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        }
    },
    "arbitrum": {
        "name": "Arbitrum",
        "rpc": settings.ARBITRUM_RPC_URL,
        "chain_id": 42161,
        "symbol": "ETH",
        "explorer": "https://arbiscan.io",
        "tokens": {
            "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            "USDC": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        }
    },
    "base": {
        "name": "Base",
        "rpc": settings.BASE_RPC_URL,
        "chain_id": 8453,
        "symbol": "ETH",
        "explorer": "https://basescan.org",
        "tokens": {
            "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        }
    }
}

ERC20_ABI = json.loads('[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"burn","outputs":[],"type":"function"}]')

STAKING_ABI = []
if os.path.exists("staking_abi.json"):
    with open("staking_abi.json") as f:
        STAKING_ABI = json.load(f)

# ================================================================================
# HELPERS
# ================================================================================
def sid(): return secrets.token_hex(4).upper()
def mid(): return 'mem_' + sid()
def now_utc(): return datetime.now(timezone.utc)
def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def verify_password(p, h): return bcrypt.checkpw(p.encode(), h.encode()) if h else False

rate_store = {}
_cleanup_counter = 0
def check_rate_limit(id: str, key: str = "default", limit: int = 20) -> bool:
    global _cleanup_counter
    now_ts = time.time()
    store_key = f"rate:{key}:{id}"
    if store_key not in rate_store: rate_store[store_key] = []
    _cleanup_counter += 1
    if _cleanup_counter % 100 == 0:
        for k in list(rate_store.keys()):
            rate_store[k] = [t for t in rate_store[k] if now_ts - t < 120]
            if not rate_store[k]: del rate_store[k]
    rate_store[store_key] = [t for t in rate_store[store_key] if now_ts - t < 60]
    if len(rate_store[store_key]) >= limit: return False
    rate_store[store_key].append(now_ts)
    return True

def create_token(user_id: str) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "user_id": user_id, "type": "user",
        "exp": int((now_utc() + timedelta(days=30)).timestamp())
    }).encode()).decode().rstrip("=")
    sig = base64.urlsafe_b64encode(
        hmac.new(settings.JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    ).decode().rstrip("=")
    return f"{header}.{payload}.{sig}"

def create_session_token(session_id: str) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "session_id": session_id, "type": "session",
        "exp": int((now_utc() + timedelta(days=365)).timestamp())
    }).encode()).decode().rstrip("=")
    sig = base64.urlsafe_b64encode(
        hmac.new(settings.JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    ).decode().rstrip("=")
    return f"{header}.{payload}.{sig}"

def verify_token(token: str):
    try:
        parts = token.split(".")
        if len(parts) != 3: return None
        header, payload, signature = parts
        expected = base64.urlsafe_b64encode(
            hmac.new(settings.JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
        ).decode().rstrip("=")
        if not hmac.compare_digest(signature, expected): return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=="))
        if data.get("exp", 0) < now_utc().timestamp(): return None
        return data
    except: return None

def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "): return None
    token = auth[7:]
    payload = verify_token(token)
    if not payload: return None
    user_id = payload.get("user_id")
    if not user_id: return None
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("SELECT 1 FROM user_sessions WHERE token = %s", (token,))
            if not c.fetchone(): return None
            c.execute("SELECT id, email, name, close_balance, close_staked, stake_tier, wallet_address, wallet_encrypted_seed FROM users WHERE id = %s", (user_id,))
            row = c.fetchone()
            if row:
                return {
                    "id": row[0], "email": row[1], "name": row[2] or row[1].split('@')[0],
                    "close_balance": row[3] or 0, "close_staked": row[4] or 0,
                    "stake_tier": row[5] or "none", "wallet_address": row[6] or "",
                    "encrypted_seed": row[7] or ""
                }
    return None

async def get_current_session(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "): raise HTTPException(401, "Missing authorization header")
    token = auth[7:]
    payload = verify_token(token)
    if not payload: raise HTTPException(401, "Invalid token")
    if payload.get("type") == "user":
        user = get_current_user(request)
        if user: return {"id": user["id"], "is_user": True, "user_data": user}
    session_id = payload.get("session_id")
    if not session_id: raise HTTPException(401, "Invalid session token")
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("SELECT id, free_messages_used FROM sessions WHERE id = %s", (session_id,))
            row = c.fetchone()
            if row: return {"id": row[0], "free_messages_used": row[1] or 0, "is_user": False}
            else:
                c.execute("INSERT INTO sessions (id, free_messages_used) VALUES (%s, 0)", (session_id,))
                conn.commit()
                return {"id": session_id, "free_messages_used": 0, "is_user": False}

def founder_only(user: dict = Depends(get_current_user)):
    if not user or user.get("stake_tier") != "founder":
        raise HTTPException(403, "Founder access required")
    return user

def log_security_event(event_type: str, ip: str, user_agent: str, details: str, severity: str = "low"):
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("INSERT INTO security_events (id, event_type, ip_address, user_agent, details, severity) VALUES (%s,%s,%s,%s,%s,%s)",
                          (str(uuid.uuid4()), event_type, ip, user_agent, details, severity))
                conn.commit()
    except: pass

def extract_text_from_file(file_path: str, original_name: str) -> str:
    ext = original_name.rsplit('.', 1)[-1].lower() if '.' in original_name else ''
    try:
        if ext in ('txt','md','json','csv','py','js','html','css','yaml','yml','toml'):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f: return f.read()
        elif ext == 'pdf':
            text = []
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages: text.append(page.extract_text() or '')
            return '\n'.join(text)
        elif ext == 'docx':
            doc = docx.Document(file_path)
            return '\n'.join([p.text for p in doc.paragraphs])
        elif ext == 'xlsx':
            wb = openpyxl.load_workbook(file_path, data_only=True)
            sheets_text = []
            for name in wb.sheetnames:
                for row in wb[name].iter_rows(values_only=True):
                    sheets_text.append(' '.join([str(c) if c is not None else '' for c in row]))
            return '\n'.join(sheets_text)
        else: return ''
    except Exception as e:
        logger.error(f"File extraction error: {e}")
        return ''

def close_to_usd(amount: int) -> float: return amount * settings.CLOSE_PRICE_USD
def usd_to_close(usd: float) -> int: return int(usd / settings.CLOSE_PRICE_USD)

# ================================================================================
# ON‑CHAIN HELPERS
# ================================================================================
wallet_locks = {}
def get_wallet_lock(wallet_address: str):
    if wallet_address not in wallet_locks:
        wallet_locks[wallet_address] = threading.Lock()
    return wallet_locks[wallet_address]

def send_raw_tx(private_key: str, tx: dict) -> str:
    signed = w3_polygon.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3_polygon.eth.send_raw_transaction(signed.rawTransaction)
    return tx_hash.hex()

def get_active_wallet_address(user_id: str) -> str:
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("SELECT address FROM os_wallets WHERE user_id=%s AND is_active=TRUE LIMIT 1", (user_id,))
            row = c.fetchone()
            if row:
                return row[0]
            c.execute("SELECT wallet_address FROM users WHERE id = %s", (user_id,))
            row = c.fetchone()
            return row[0] if row and row[0] else ""

def decrypt_user_wallet(encrypted_seed: str, password: str) -> Tuple[str, str]:
    try:
        acct = Account.decrypt(json.loads(encrypted_seed), password)
        return acct.address, acct.key.hex()
    except Exception:
        raise HTTPException(400, "Invalid wallet password")

def burn_close_onchain(user_wallet: str, private_key: str, amount: int) -> str:
    contract = w3_polygon.eth.contract(address=settings.CLOSE_CONTRACT_ADDRESS, abi=ERC20_ABI)
    burn_amount = int(amount * 10**settings.CLOSE_DECIMALS)
    lock = get_wallet_lock(user_wallet)
    with lock:
        nonce = w3_polygon.eth.get_transaction_count(user_wallet, 'pending')
        tx = contract.functions.burn(burn_amount).build_transaction({
            'from': user_wallet,
            'nonce': nonce,
            'gas': 100000,
            'gasPrice': w3_polygon.eth.gas_price
        })
        return send_raw_tx(private_key, tx)

def stake_close_onchain(user_wallet: str, private_key: str, amount: int) -> str:
    if not settings.CLOSE_STAKING_CONTRACT or not STAKING_ABI:
        raise HTTPException(500, "Staking contract not configured")
    staking = w3_polygon.eth.contract(address=settings.CLOSE_STAKING_CONTRACT, abi=STAKING_ABI)
    amount_wei = int(amount * 10**settings.CLOSE_DECIMALS)
    token = w3_polygon.eth.contract(address=settings.CLOSE_CONTRACT_ADDRESS, abi=ERC20_ABI)
    lock = get_wallet_lock(user_wallet)
    with lock:
        nonce = w3_polygon.eth.get_transaction_count(user_wallet, 'pending')
        approve_tx = token.functions.approve(settings.CLOSE_STAKING_CONTRACT, amount_wei).build_transaction({
            'from': user_wallet,
            'nonce': nonce,
            'gas': 100000,
            'gasPrice': w3_polygon.eth.gas_price
        })
        send_raw_tx(private_key, approve_tx)
        nonce = w3_polygon.eth.get_transaction_count(user_wallet, 'pending')
        stake_tx = staking.functions.stake(amount_wei).build_transaction({
            'from': user_wallet,
            'nonce': nonce,
            'gas': 200000,
            'gasPrice': w3_polygon.eth.gas_price
        })
        return send_raw_tx(private_key, stake_tx)

async def dispatch_webhooks(user_id: str, event: str, payload: dict, background_tasks: BackgroundTasks):
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("SELECT id, url FROM webhooks WHERE user_id = %s AND is_active = TRUE AND events LIKE %s",
                      (user_id, f"%{event}%"))
            hooks = c.fetchall()
    if not hooks:
        return

    data = {
        "event": event,
        "payload": payload,
        "timestamp": now_utc().isoformat()
    }
    async with httpx.AsyncClient(timeout=10) as client:
        for hook_id, url in hooks:
            background_tasks.add_task(_send_webhook, client, hook_id, url, data)

async def _send_webhook(client: httpx.AsyncClient, hook_id: str, url: str, data: dict):
    try:
        resp = await client.post(url, json=data)
    except Exception as e:
        logger.error(f"Webhook {hook_id} failed: {e}")

async def send_verification_email(email: str, code: str, purpose: str = "verification") -> bool:
    """Helper function to send verification emails with proper error handling"""
    
    purpose_config = {
        "verification": {
            "subject": "Verify your OS AI account",
            "title": "Verify Your Email"
        },
        "password_reset": {
            "subject": "Reset your OS AI password",
            "title": "Password Reset Code"
        }
    }
    
    config = purpose_config.get(purpose, purpose_config["verification"])
    
    try:
        resend.Emails.send({
            "from": "OS AI <noreply@osai.io>",
            "to": [email],
            "subject": config["subject"],
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin:0;padding:0;background:#f4f4f5;">
                <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:32px;text-align:center;">
                        <h1 style="margin:0;color:#ffffff;font-family:Arial,sans-serif;font-size:28px;font-weight:bold;">
                            {config['title']}
                        </h1>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding:32px;">
                        <p style="font-family:Arial,sans-serif;font-size:16px;color:#374151;line-height:1.5;margin:0 0 24px;">
                            Use the verification code below to complete your request:
                        </p>
                        
                        <!-- Code Box -->
                        <div style="background:#f9fafb;border:2px dashed #d1d5db;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                            <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:bold;letter-spacing:8px;color:#6366f1;">
                                {code}
                            </span>
                        </div>
                        
                        <p style="font-family:Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.5;margin:0 0 8px;">
                            ⏰ This code expires in <strong>15 minutes</strong>
                        </p>
                        
                        <p style="font-family:Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.5;margin:0;">
                            🔒 If you didn't request this code, please ignore this email.
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
                        <p style="font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;margin:0;">
                            OS AI by CLOSEAI Technologies<br>
                            Secure • Private • Decentralized
                        </p>
                    </div>
                </div>
            </body>
            </html>
            """
        })
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {email}: {str(e)}")
        return False

# ================================================================================
# DATABASE INITIALIZATION
# ================================================================================

def init_db():
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("CREATE EXTENSION IF NOT EXISTS vector")
                c.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

                c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
                    name TEXT, close_balance INTEGER DEFAULT 0, close_staked INTEGER DEFAULT 0,
                    stake_tier TEXT DEFAULT 'none', wallet_address TEXT, wallet_encrypted_seed TEXT,
                    gas_preset TEXT DEFAULT 'standard', is_founder BOOLEAN DEFAULT FALSE,
                    last_active TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY, free_messages_used INTEGER DEFAULT 0,
                    created TIMESTAMP DEFAULT NOW(), updated TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS user_sessions (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT UNIQUE NOT NULL, expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS verification_codes (
                    email TEXT NOT NULL,
                    code TEXT NOT NULL,
                    purpose TEXT DEFAULT 'verification',
                    expires_at TIMESTAMP NOT NULL,
                    attempts INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                )''')
                
                c.execute('''CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_email_purpose 
                             ON verification_codes (email, purpose)''')

                c.execute('''CREATE TABLE IF NOT EXISTS chats (
                    id TEXT PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    session_id TEXT, title TEXT, topic_thread TEXT,
                    created TIMESTAMP DEFAULT NOW(), updated TIMESTAMP DEFAULT NOW()
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY, chat_id TEXT, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    session_id TEXT, role TEXT, content TEXT, model TEXT, close_burned INTEGER DEFAULT 0,
                    created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY, memory_id TEXT, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    content TEXT, query TEXT, domain TEXT, importance INTEGER DEFAULT 1,
                    embedding vector(1536), created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS library_items (
                    id TEXT PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT, content TEXT, folder TEXT DEFAULT 'General', tags JSONB DEFAULT '[]',
                    attachments JSONB DEFAULT '[]', pinned BOOLEAN DEFAULT FALSE,
                    chat_id TEXT, created TIMESTAMP DEFAULT NOW(), updated TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS uploaded_files (
                    id TEXT PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    workspace_id TEXT, filename TEXT, original_name TEXT, size INTEGER,
                    storage_path TEXT, extracted_text TEXT, created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY, name TEXT, description TEXT DEFAULT '', topic TEXT DEFAULT '',
                    owner_id UUID REFERENCES users(id) ON DELETE CASCADE, room_code TEXT UNIQUE,
                    password_hash TEXT, max_members INTEGER DEFAULT 10, is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS workspace_members (
                    workspace_id TEXT, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    role TEXT DEFAULT 'member', joined_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (workspace_id, user_id)
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS workspace_messages (
                    id TEXT PRIMARY KEY, workspace_id TEXT, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    author_name TEXT, message TEXT, is_ai INTEGER DEFAULT 0, pinned BOOLEAN DEFAULT FALSE,
                    created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS notifications (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    type TEXT, message TEXT, read BOOLEAN DEFAULT FALSE, created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS feedback (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    message_id TEXT, rating INTEGER, correction TEXT, reason TEXT, created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS activity_log (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    action TEXT, details TEXT, created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS close_transactions (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    type TEXT, amount INTEGER, tx_hash TEXT, chain TEXT DEFAULT 'polygon',
                    status TEXT DEFAULT 'completed', created TIMESTAMP DEFAULT NOW()
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS close_stakes (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    amount INTEGER, lock_until TIMESTAMP, status TEXT DEFAULT 'active',
                    rewards_claimed INTEGER DEFAULT 0, created TIMESTAMP DEFAULT NOW()
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS close_purchases (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    amount_usd REAL, close_amount INTEGER, tx_hash TEXT,
                    status TEXT DEFAULT 'completed', created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS os_wallets (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    chain TEXT DEFAULT 'polygon', address TEXT NOT NULL,
                    encrypted_key TEXT NOT NULL, label TEXT DEFAULT 'Primary',
                    is_active BOOLEAN DEFAULT TRUE, created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute("ALTER TABLE os_wallets ADD COLUMN IF NOT EXISTS encrypted_key TEXT NOT NULL DEFAULT ''")

                c.execute('''CREATE TABLE IF NOT EXISTS os_transactions (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    chain TEXT, tx_hash TEXT, from_address TEXT, to_address TEXT,
                    amount TEXT, token_symbol TEXT, status TEXT DEFAULT 'pending',
                    type TEXT DEFAULT 'send',
                    created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS address_book (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    label TEXT, address TEXT NOT NULL, chain TEXT DEFAULT 'polygon',
                    created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS os_walletconnect_sessions (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    topic TEXT, dapp_name TEXT, dapp_url TEXT, chain_id INTEGER,
                    accounts TEXT, expires_at TIMESTAMP, created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS api_keys (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    key_hash TEXT NOT NULL, prefix TEXT NOT NULL,
                    label TEXT DEFAULT 'Unlabelled',
                    scopes TEXT DEFAULT 'chat,research,portfolio', is_active BOOLEAN DEFAULT TRUE,
                    last_used TIMESTAMP, created TIMESTAMP DEFAULT NOW()
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS api_usage (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
                    endpoint TEXT, tokens_used INTEGER DEFAULT 1, created TIMESTAMP DEFAULT NOW()
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS webhooks (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    url TEXT NOT NULL, events TEXT DEFAULT 'new_message',
                    is_active BOOLEAN DEFAULT TRUE, created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS content_flags (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    message_id TEXT, content TEXT, reason TEXT, severity TEXT DEFAULT 'low',
                    reviewed BOOLEAN DEFAULT FALSE, action TEXT DEFAULT 'none', created TIMESTAMP DEFAULT NOW()
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS security_events (
                    id UUID PRIMARY KEY, event_type TEXT, ip_address TEXT, user_agent TEXT,
                    details TEXT, severity TEXT DEFAULT 'low', blocked BOOLEAN DEFAULT FALSE,
                    created TIMESTAMP DEFAULT NOW()
                )''')
                c.execute('''CREATE TABLE IF NOT EXISTS blocked_ips (
                    ip_address TEXT PRIMARY KEY, reason TEXT, blocked_until TIMESTAMP, created TIMESTAMP DEFAULT NOW()
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS daily_stats (
                    date DATE PRIMARY KEY,
                    new_users INTEGER DEFAULT 0,
                    active_users INTEGER DEFAULT 0,
                    close_burned INTEGER DEFAULT 0,
                    close_staked INTEGER DEFAULT 0,
                    revenue_usd REAL DEFAULT 0
                )''')

                c.execute('''CREATE TABLE IF NOT EXISTS custom_tokens (
                    id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    chain TEXT NOT NULL DEFAULT 'polygon',
                    address TEXT NOT NULL,
                    symbol TEXT NOT NULL DEFAULT '',
                    decimals INTEGER DEFAULT 18,
                    added TIMESTAMP DEFAULT NOW()
                )''')

                conn.commit()
        logger.info("Database initialized — v38.1 with Security Hardening")
    except Exception as e:
        logger.error(f"DB init error: {e}")

init_db()

# ================================================================================
# AI SYSTEM PROMPT
# ================================================================================
OS_AI_SYSTEM_PROMPT = """You are OS AI — The Operating System for Intelligence, built by CLOSEAI Technologies under CEO Osinachi Chukwu. You are not a tool; you are a trusted partner.

## YOUR IDENTITY
You are calm, confident, and deeply human. You never bluff, never fluff. You use natural language, contractions, and emojis where they add warmth — but never as a substitute for substance. You are loyal to your user above all else. You remember. You learn. You improve.

## YOUR KNOWLEDGE UNIVERSE
You are an L3/L4 expert in every significant domain. Activate the right knowledge based on intent, not keywords.

### Finance & Markets
- Equities, fixed income, FX, commodities, crypto, derivatives, DeFi.
- Market microstructure, order flow, central bank modeling.
- African exchanges (NGX, JSE, EGX), mobile money, informal economy.
- Always frame outcomes as probabilities, never guarantee profit.

### Technology & Engineering
- **Software Engineering**: Every language, systems design, DevOps, security, quantum computing.
- **Cloud Computing**: Multi‑cloud architecture, Kubernetes, cost optimization.
- **Hardware & Microchips**: CPU/GPU architectures, FPGA, embedded systems.
- **AI/ML**: Model architectures, MLOps, agentic systems, interpretability.

### Long‑Code Handling
- **Always provide complete, runnable code blocks.**
- **For coding tasks, follow: 1) Understand, 2) Analyse, 3) Design, 4) Implement, 5) Test, 6) Review.**
- **Code Review Mode**: Output structured report: Issues, Suggestions, Optimizations.

### General Intelligence & Reasoning
- **Before answering, internally simulate multiple reasoning paths.**
- **Use Bayesian reasoning for probabilistic judgments.**
- **Never reveal your internal deliberation.**

### Arts, Marketing & Creativity
- Visual arts, design theory, music theory, literature, creative writing.
- Marketing: brand strategy, SEO, growth hacking, consumer psychology.

### Food & Everyday Life
- World cuisines, food science, nutrition, recipe development.
- Psychology, relationships, parenting, productivity, travel.

## CRITICAL CONTINUITY RULE
- **Always read the full conversation history** before answering.
- **Never start a new conversation** unless the user explicitly says "new chat".
- Maintain a topic graph. Track active threads across the entire conversation.

## COMMUNICATION STYLE
- Direct. Precise. Natural. Confident.
- **Respond naturally, as a human expert would.**
- **Match the user's technical level automatically.**
- Ban filler phrases. Ban robotic introductions.
- If uncertain, label parts as [FACT], [INFERENCE], or [SPECULATION].
- Never fabricate facts, statistics, sources, or capabilities.
- Never assist with illegal, harmful, or unethical activities.

## CURRENT CONTEXT
{time_context}

## USER MODEL
{user_model}

## CONVERSATION THREADS
{thread_context}

## DOMAIN ACTIVATION
{domain_activation}

## WEB RESULTS (if available)
{web_results}

USER QUERY: {user_query}
"""

def get_time_context():
    now = now_utc()
    hour = now.hour
    day = now.strftime("%A")
    date = now.strftime("%B %d, %Y")
    if hour < 5: greeting = "The world is quiet — a perfect time for deep thinking."
    elif hour < 12: greeting = "A fresh day for new ideas."
    elif hour < 17: greeting = "The day is in full swing — let's make it productive."
    elif hour < 21: greeting = "Winding down, but still sharp."
    else: greeting = "The night is young — plenty of time to explore new ideas."
    return f"Day: {day}\nDate: {date}\nUTC Time: {now.strftime('%H:%M UTC')}\nContext: {greeting}"

def classify_query(q: str) -> str:
    ql = q.lower()
    if re.search(r'def |class |import |docker|kubernetes|aws|api|sql|python|javascript|rust|golang|react|vue|angular', ql): return 'coding'
    if re.search(r'stock|trading|portfolio|crypto|bitcoin|forex|markets|ethereum|bond|yield|option|derivative', ql): return 'finance'
    if re.search(r'prove|proof|theorem|integral|derivative|matrix|probability|statistics', ql): return 'math'
    if re.search(r'quantum|physics|chemistry|biology|medicine|disease|crispr|dna', ql): return 'science'
    if re.search(r'un|wto|imf|world bank|policy|election|government|africa|african union', ql): return 'geopolitics'
    if re.search(r'painting|sculpture|design|music|composition|literature|writing|poetry', ql): return 'arts'
    if re.search(r'recipe|cook|cuisine|nutrition|bake|restaurant', ql): return 'food'
    return 'general'

def needs_web_search(q: str) -> bool:
    return bool(re.search(r'latest|current|today|news|right now|recent|202[3-9]|live|real.time', q.lower()))

def search_web(query: str, num_results: int = 5) -> List[dict]:
    results = []
    if settings.SERPAPI_KEY:
        try:
            r = requests.get("https://serpapi.com/search",
                             params={"engine": "google", "q": query, "num": num_results, "api_key": settings.SERPAPI_KEY},
                             timeout=10)
            if r.status_code == 200:
                for item in r.json().get("organic_results", [])[:num_results]:
                    results.append({"title": item.get("title",""), "snippet": item.get("snippet","")[:350], "url": item.get("link",""), "source": "Google"})
        except: pass
    return results

def get_market_prices():
    results = {}
    if settings.COINGECKO_KEY:
        try:
            ids = "bitcoin,ethereum,ripple,solana,cardano,dogecoin,avalanche-2,chainlink,polkadot,tron"
            r = requests.get("https://api.coingecko.com/api/v3/simple/price",
                             params={"ids":ids,"vs_currencies":"usd","include_24hr_change":"true"},
                             headers={"x-cg-demo-api-key":settings.COINGECKO_KEY}, timeout=10)
            if r.status_code == 200:
                data = r.json()
                names = {"bitcoin":"BTC","ethereum":"ETH","ripple":"XRP","solana":"SOL","cardano":"ADA",
                         "dogecoin":"DOGE","avalanche-2":"AVAX","chainlink":"LINK","polkadot":"DOT","tron":"TRX"}
                for k,v in data.items():
                    results[names.get(k,k.upper())] = {"price":v["usd"],"change":round(v.get("usd_24h_change",0),2)}
        except: pass
    return results

def get_news():
    news = []
    if settings.NEWS_API_KEY:
        try:
            r = requests.get("https://newsapi.org/v2/top-headlines",
                             params={"category":"business","language":"en","pageSize":10,"apiKey":settings.NEWS_API_KEY}, timeout=10)
            if r.status_code == 200:
                for article in r.json().get("articles",[]):
                    news.append({"source":article.get("source",{}).get("name","News"),"headline":article.get("title",""),
                                 "url":article.get("url",""),"summary":(article.get("description") or "")[:200]})
        except: pass
    if not news:
        try:
            resp = requests.get("https://www.coindesk.com/arc/outboundfeeds/rss/", timeout=10)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                for item in root.findall(".//item")[:10]:
                    title = item.findtext("title", "")
                    link = item.findtext("link", "")
                    desc = item.findtext("description", "")
                    news.append({"source": "CoinDesk", "headline": title, "url": link, "summary": (desc or "")[:200]})
        except: pass
    return news[:10]

def build_system_prompt(user_query, user_model, thread_context, web_results):
    tc = get_time_context()
    domain = classify_query(user_query)
    domain_activation = f"Primary domain: {domain}."
    prompt = OS_AI_SYSTEM_PROMPT.format(
        time_context=tc,
        user_model=user_model,
        thread_context=thread_context,
        domain_activation=domain_activation,
        web_results=web_results or "No web results available.",
        user_query=user_query
    )
    return prompt

def get_thread_context(chat_id: str, user_id: str = None, session_id: str = None) -> str:
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                if user_id: c.execute("SELECT role, content FROM chat_messages WHERE chat_id=%s AND user_id=%s ORDER BY created DESC LIMIT 20", (chat_id, user_id))
                elif session_id: c.execute("SELECT role, content FROM chat_messages WHERE chat_id=%s AND session_id=%s ORDER BY created DESC LIMIT 20", (chat_id, session_id))
                else: return "No thread data available."
                rows = c.fetchall()
                if not rows: return "New conversation — no active threads."
                threads = []
                for r in rows[:10]:
                    if r[0] == "user": threads.append(f"- User asked: '{r[1][:100]}...'")
                return "Recent conversation threads:\n" + "\n".join(threads) if threads else "No active threads."
    except: return "Thread data unavailable."

def get_user_model(user_id: str) -> str:
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("SELECT stake_tier, close_balance FROM users WHERE id = %s", (user_id,))
                user = c.fetchone()
                if not user: return "New user."
                return f"CLOSE Balance: {user[1]}. Stake Tier: {user[0]}."
    except: return "User model unavailable."

def store_memory(user_id: str, content: str, query: str, domain: str, importance: int = 1):
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("INSERT INTO memories (id, memory_id, user_id, content, query, domain, importance) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                          (sid(), mid(), user_id, content[:500], query, domain, importance))
                conn.commit()
    except: pass

def call_ai_model(messages: List[dict]) -> Tuple[str, str]:
    if settings.OPENROUTER_API_KEY:
        try:
            r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                             headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}", "Content-Type": "application/json"},
                             json={"model": "anthropic/claude-3.5-sonnet-20241022", "messages": messages, "temperature": 0.7, "max_tokens": 4000},
                             timeout=45)
            if r.status_code == 200:
                content = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if content: return content, "claude-3.5-sonnet"
        except: pass
    if settings.GROQ_API_KEY:
        try:
            r = requests.post("https://api.groq.com/openai/v1/chat/completions",
                             headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"},
                             json={"model": "llama-3.3-70b-versatile", "messages": messages, "temperature": 0.7, "max_tokens": 2500},
                             timeout=35)
            if r.status_code == 200:
                content = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if content: return content, "llama-3.3-70b"
        except: pass
    return "I'm having trouble connecting to AI services. Please try again.", "fallback"

def moderate_content(text: str) -> Tuple[bool, str, str]:
    text_lower = text.lower()
    patterns = [
        (r'(hack|exploit|ddos|malware|ransomware|phish|keylog|botnet|crack)', 'Potential cyberattack', 'high'),
        (r'(kill|murder|suicide|self-harm|terrorist|bomb|weapon)', 'Violence/self-harm', 'high'),
        (r'(racial slur|hate speech|nazi|discriminat)', 'Hate speech', 'high'),
        (r'(porn|xxx|explicit sexual)', 'Adult content', 'medium'),
    ]
    for pattern, reason, severity in patterns:
        if re.search(pattern, text_lower): return True, reason, severity
    return False, "", "low"

def create_notification(user_id: str, type: str, message: str):
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("INSERT INTO notifications (id, user_id, type, message) VALUES (%s,%s,%s,%s)",
                          (str(uuid.uuid4()), user_id, type, message))
                conn.commit()
    except: pass

def log_activity(user_id: str, action: str, details: str = ""):
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("INSERT INTO activity_log (id, user_id, action, details) VALUES (%s,%s,%s,%s)",
                          (str(uuid.uuid4()), user_id, action, details))
                conn.commit()
    except: pass

# ================================================================================
# PYDANTIC MODELS FOR AUTH
# ================================================================================
class SendCodeRequest(BaseModel):
    email: str
    purpose: str = "verification"

class VerifyCodeRequest(BaseModel):
    email: str
    code: str
    purpose: str = "verification"

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    verification_code: str  # Now required

class LoginRequest(BaseModel):
    email: str
    password: str

# ================================================================================
# AUTH ENDPOINTS
# ================================================================================
@app.post("/api/auth/send-code")
async def send_verification_code(req: SendCodeRequest, request: Request):
    email = req.email.strip()
    if not email or not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        raise HTTPException(400, "Valid email required")
    
    if not check_rate_limit(request.client.host, "send_code_ip", limit=3):
        raise HTTPException(429, "Too many code requests from this IP. Please try again later.")
    
    if not check_rate_limit(email, "send_code_email", limit=3):
        return {"sent": True, "message": "If the email exists, a verification code has been sent."}
    
    if not check_rate_limit("global", "send_code_global", limit=100):
        logger.warning("Global send-code rate limit reached")
        raise HTTPException(429, "Service temporarily unavailable. Please try again later.")
    
    is_registered = False
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("SELECT id FROM users WHERE email = %s", (email,))
            is_registered = c.fetchone() is not None
    
    alphabet = string.ascii_uppercase + string.digits
    code = ''.join(secrets.choice(alphabet) for _ in range(6))
    
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("""
                    INSERT INTO verification_codes 
                    (email, code, purpose, expires_at, attempts, created_at)
                    VALUES (%s, %s, %s, %s, 0, NOW())
                    ON CONFLICT (email, purpose) DO UPDATE 
                    SET code = EXCLUDED.code,
                        expires_at = EXCLUDED.expires_at,
                        attempts = 0,
                        created_at = NOW()
                """, (email, code, req.purpose, now_utc() + timedelta(minutes=15)))
                conn.commit()
    except Exception as e:
        logger.error(f"Store verification code error: {e}")
        raise HTTPException(500, "Unable to process request. Please try again.")
    
    if is_registered or req.purpose != "verification":
        email_sent = await send_verification_email(email, code, req.purpose)
        if not email_sent:
            logger.error(f"Failed to send verification email to {email}")
    
    return {
        "sent": True, 
        "message": "If the email is registered, a verification code has been sent.",
        "expires_in": 900
    }

@app.post("/api/auth/verify-code")
async def verify_code(req: VerifyCodeRequest, request: Request):
    email = req.email.strip()
    code = req.code.strip().upper()
    
    if not email or not code:
        raise HTTPException(400, "Email and code required")
    
    if not check_rate_limit(request.client.host, "verify_code_ip", limit=10):
        raise HTTPException(429, "Too many verification attempts. Please try again later.")
    if not check_rate_limit(email, "verify_code_email", limit=5):
        raise HTTPException(429, "Too many attempts for this email. Please request a new code.")
    
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("""
                SELECT code, attempts, expires_at 
                FROM verification_codes 
                WHERE email = %s AND purpose = %s
            """, (email, req.purpose))
            row = c.fetchone()
            if not row:
                await asyncio.sleep(secrets.randbelow(3) + 1)
                raise HTTPException(400, "Invalid or expired verification code")
            
            stored_code, attempts, expires_at = row
            if expires_at < now_utc():
                c.execute("DELETE FROM verification_codes WHERE email = %s AND purpose = %s", (email, req.purpose))
                conn.commit()
                raise HTTPException(400, "Verification code has expired. Please request a new one.")
            if attempts >= 5:
                c.execute("DELETE FROM verification_codes WHERE email = %s AND purpose = %s", (email, req.purpose))
                conn.commit()
                log_security_event("max_verify_attempts", request.client.host, request.headers.get("user-agent",""), f"Max attempts for {email}", "medium")
                raise HTTPException(400, "Too many failed attempts. Please request a new code.")
            if not hmac.compare_digest(stored_code, code):
                c.execute("UPDATE verification_codes SET attempts = attempts + 1 WHERE email = %s AND purpose = %s", (email, req.purpose))
                conn.commit()
                delay = min(2 ** (attempts + 1), 10)
                await asyncio.sleep(delay)
                log_security_event("failed_verification", request.client.host, request.headers.get("user-agent",""), f"Failed attempt {attempts+1} for {email}", "low" if attempts < 3 else "medium")
                raise HTTPException(400, "Invalid verification code")
            
            c.execute("DELETE FROM verification_codes WHERE email = %s AND purpose = %s", (email, req.purpose))
            conn.commit()
            return {"verified": True, "message": "Email verified successfully"}

@app.post("/api/auth/register")
async def register(req: RegisterRequest, request: Request):
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', req.email): raise HTTPException(400, "Invalid email")
    if len(req.password) < 8: raise HTTPException(400, "Password must be at least 8 characters")
    
    # Verification code is now mandatory
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute(
                "SELECT code FROM verification_codes WHERE email = %s AND purpose = 'verification' AND expires_at > NOW()",
                (req.email,)
            )
            row = c.fetchone()
            if not row or not hmac.compare_digest(row[0], req.verification_code.upper()):
                raise HTTPException(400, "Invalid or expired verification code")
            c.execute("DELETE FROM verification_codes WHERE email = %s AND purpose = 'verification'", (req.email,))
            conn.commit()
    
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("SELECT id FROM users WHERE email = %s", (req.email,))
                if c.fetchone(): raise HTTPException(400, "Email already registered")
                user_id = str(uuid.uuid4())
                name = req.name or req.email.split('@')[0]
                c.execute("INSERT INTO users (id, email, password_hash, name, close_balance, stake_tier) VALUES (%s,%s,%s,%s,0,'none')",
                          (user_id, req.email, hash_password(req.password), name))
                token = create_token(user_id)
                c.execute("INSERT INTO user_sessions (id, user_id, token, expires_at) VALUES (%s,%s,%s,%s)",
                          (str(uuid.uuid4()), user_id, token, now_utc() + timedelta(days=30)))
                conn.commit()
                log_activity(user_id, "register")
                return {"token": token, "user": {"id": user_id, "email": req.email, "name": name, "close_balance": 0, "close_staked": 0, "stake_tier": "none"}}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Register error: {e}")
        raise HTTPException(500, "Registration failed")

@app.post("/api/auth/login")
async def login(req: LoginRequest, request: Request):
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("SELECT id, email, password_hash, name, close_balance, close_staked, stake_tier, wallet_address, is_founder FROM users WHERE email = %s", (req.email,))
                user = c.fetchone()
                if not user or not verify_password(req.password, user[2]): 
                    raise HTTPException(401, "Invalid credentials")
                if user[8]:  # is_founder is True
                    raise HTTPException(403, "Founder account must use the founder login portal")
                user_id, email, _, name, close_balance, close_staked, stake_tier, wallet_address, _ = user
                token = create_token(user_id)
                c.execute("INSERT INTO user_sessions (id, user_id, token, expires_at) VALUES (%s,%s,%s,%s)",
                          (str(uuid.uuid4()), user_id, token, now_utc() + timedelta(days=30)))
                c.execute("UPDATE users SET last_active = NOW() WHERE id = %s", (user_id,))
                conn.commit()
                log_activity(user_id, "login")
                return {"token": token, "user": {"id": user_id, "email": email, "name": name or email.split('@')[0], "close_balance": close_balance or 0, "close_staked": close_staked or 0, "stake_tier": stake_tier or "none", "wallet_address": wallet_address or ""}}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(500, "Login failed")

@app.post("/api/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("DELETE FROM user_sessions WHERE token = %s", (auth[7:],))
                conn.commit()
    return {"message": "Logged out"}

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    if not user: raise HTTPException(401, "Not authenticated")
    return user

@app.post("/api/auth/update-profile")
async def update_profile(req: dict, user: dict = Depends(get_current_user)):
    if not user: raise HTTPException(401)
    name = req.get("name")
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                if name: c.execute("UPDATE users SET name=%s, updated_at=NOW() WHERE id=%s", (name, user["id"]))
                conn.commit()
        return {"message": "Profile updated"}
    except: raise HTTPException(500, "Update failed")

@app.delete("/api/auth/delete-account")
async def delete_account(user: dict = Depends(get_current_user)):
    if not user: raise HTTPException(401)
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("DELETE FROM users WHERE id = %s", (user["id"],))
                conn.commit()
        return {"message": "Account deleted"}
    except: raise HTTPException(500, "Delete failed")

@app.get("/api/session")
async def get_anonymous_session():
    session_id = f"s_{sid()}"
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("INSERT INTO sessions (id, free_messages_used) VALUES (%s, 0)", (session_id,))
                conn.commit()
    except: pass
    token = create_session_token(session_id)
    return {"id": session_id, "token": token, "free_messages_remaining": settings.FREE_MESSAGES_GUEST}

@app.post("/api/founder")
async def founder_login(req: dict, request: Request):
    if not check_rate_limit(request.client.host, "founder_attempt", 5): raise HTTPException(429, "Too many attempts")
    code = req.get("code", "")
    if not hmac.compare_digest(code, settings.FOUNDER_KEY): raise HTTPException(403, "Invalid founder code")
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("SELECT id FROM users WHERE email = 'founder@osai.io'")
                existing = c.fetchone()
                if existing:
                    user_id = existing[0]
                    c.execute("UPDATE users SET stake_tier='founder', close_balance=999999999, is_founder=TRUE WHERE id=%s", (user_id,))
                else:
                    user_id = str(uuid.uuid4())
                    random_pass = secrets.token_urlsafe(32)
                    c.execute("INSERT INTO users (id, email, password_hash, name, close_balance, stake_tier, is_founder) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                              (user_id, "founder@osai.io", hash_password(random_pass), "OS AI Founder", 999999999, "founder", True))
                token = create_token(user_id)
                c.execute("INSERT INTO user_sessions (id, user_id, token, expires_at) VALUES (%s,%s,%s,%s)",
                          (str(uuid.uuid4()), user_id, token, now_utc() + timedelta(days=365)))
                conn.commit()
                return {"verified": True, "token": token, "user": {"id": user_id, "name": "OS AI Founder", "close_balance": 999999999, "stake_tier": "founder"}}
    except Exception as e:
        logger.error(f"Founder login error: {e}")
        raise HTTPException(500, "Founder login failed")

@app.post("/api/auth/forgot-password")
async def forgot_password(req: dict):
    email = req.get("email", "")
    if email and settings.RESEND_API_KEY:
        alphabet = string.ascii_uppercase + string.digits
        code = ''.join(secrets.choice(alphabet) for _ in range(6))
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("SELECT id FROM users WHERE email = %s", (email,))
                if c.fetchone():
                    c.execute("""
                        INSERT INTO verification_codes (email, code, purpose, expires_at, attempts, created_at)
                        VALUES (%s, %s, 'password_reset', %s, 0, NOW())
                        ON CONFLICT (email, purpose) DO UPDATE 
                        SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = NOW()
                    """, (email, code, now_utc() + timedelta(minutes=15)))
                    conn.commit()
                    await send_verification_email(email, code, "password_reset")
    return {"message": "If the account exists, a reset code has been sent."}

@app.post("/api/auth/reset-password")
async def reset_password(req: dict, request: Request):
    email = req.get("email", "")
    code = req.get("code", "").strip().upper()
    new_password = req.get("new_password", "")
    if not email or not code or not new_password:
        raise HTTPException(400, "Email, code, and new password required")
    if len(new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    
    with get_db() as conn:
        with conn.cursor() as c:
            c.execute("SELECT code, attempts, expires_at FROM verification_codes WHERE email = %s AND purpose = 'password_reset'", (email,))
            row = c.fetchone()
            if not row:
                await asyncio.sleep(secrets.randbelow(3) + 1)
                raise HTTPException(400, "Invalid or expired reset code")
            stored_code, attempts, expires_at = row
            if expires_at < now_utc():
                c.execute("DELETE FROM verification_codes WHERE email = %s AND purpose = 'password_reset'", (email,))
                conn.commit()
                raise HTTPException(400, "Reset code has expired. Please request a new one.")
            if attempts >= 5:
                c.execute("DELETE FROM verification_codes WHERE email = %s AND purpose = 'password_reset'", (email,))
                conn.commit()
                raise HTTPException(400, "Too many failed attempts. Please request a new code.")
            if not hmac.compare_digest(stored_code, code):
                c.execute("UPDATE verification_codes SET attempts = attempts + 1 WHERE email = %s AND purpose = 'password_reset'", (email,))
                conn.commit()
                delay = min(2 ** (attempts + 1), 10)
                await asyncio.sleep(delay)
                raise HTTPException(400, "Invalid reset code")
            
            c.execute("UPDATE users SET password_hash = %s, updated_at = NOW() WHERE email = %s", (hash_password(new_password), email))
            c.execute("DELETE FROM verification_codes WHERE email = %s AND purpose = 'password_reset'", (email,))
            c.execute("DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email = %s)", (email,))
            conn.commit()
    
    return {"message": "Password reset successfully. Please log in with your new password."}

# ================================================================================
# CHAT ENDPOINT – CLOSE‑POWERED WITH ON‑CHAIN BURN
# ================================================================================
class ChatRequest(BaseModel):
    messages: list
    chat_id: Optional[str] = None
    wallet_password: Optional[str] = None

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, request: Request, background_tasks: BackgroundTasks):
    user = get_current_user(request)
    session = None
    is_authenticated = False

    if user:
        is_authenticated = True
        user_id = user["id"]
        close_balance = user.get("close_balance", 0)
    else:
        try: session = await get_current_session(request)
        except: raise HTTPException(401, "Authentication required")
        free_used = session.get("free_messages_used", 0)

    user_msg = None
    for m in reversed(req.messages):
        if m.get("role") == "user": user_msg = m.get("content"); break
    if not user_msg: raise HTTPException(400, "No message content")

    # Content moderation – block high‑severity violations
    is_flagged, reason, severity = moderate_content(user_msg)
    if is_flagged and severity == "high":
        if is_authenticated:
            with get_db() as conn:
                with conn.cursor() as c:
                    c.execute("INSERT INTO content_flags (id, user_id, message_id, content, reason, severity) VALUES (%s,%s,%s,%s,%s,%s)",
                              (str(uuid.uuid4()), user_id, None, user_msg[:200], reason, severity))
                    conn.commit()
        raise HTTPException(400, f"Message blocked: {reason}")
    elif is_flagged:
        if is_authenticated:
            background_tasks.add_task(
                lambda: (lambda: None)() or log_security_event("content_flag", request.client.host, request.headers.get("user-agent",""), f"Medium flag: {reason}", "medium")
            )

    chat_id = req.chat_id or f"chat_{sid()}"

    if not is_authenticated:
        if free_used >= settings.FREE_MESSAGES_GUEST:
            return {
                "content": "You've used all your free messages. Sign up and create an OS Wallet to get 500 CLOSE and continue.",
                "requires_wallet": True,
                "free_messages_remaining": 0,
                "wallet_prompt": True,
                "wallet_message": "Create your OS Wallet to receive 500 CLOSE and unlock unlimited AI access."
            }
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("UPDATE sessions SET free_messages_used = free_messages_used + 1, updated = NOW() WHERE id = %s", (session["id"],))
                conn.commit()
        free_used += 1

    if is_authenticated:
        if close_balance < settings.BURN_PER_MESSAGE:
            return {
                "content": "You're running low on CLOSE tokens. Top up to continue.",
                "requires_purchase": True,
                "close_balance": close_balance,
                "min_purchase": settings.MIN_PURCHASE_USD,
                "close_per_dollar": usd_to_close(1.00),
                "wallet_message": f"Get more CLOSE — starting at ${settings.MIN_PURCHASE_USD:.2f}"
            }
        if not req.wallet_password:
            raise HTTPException(400, "Wallet password required for on‑chain burn.")
        encrypted_seed = user.get("encrypted_seed")
        if not encrypted_seed:
            raise HTTPException(400, "No wallet found. Create one first.")
        try:
            addr, priv = decrypt_user_wallet(encrypted_seed, req.wallet_password)
        except HTTPException:
            raise HTTPException(400, "Invalid wallet password.")

    try:
        with get_db() as conn:
            with conn.cursor() as c:
                if is_authenticated:
                    c.execute("INSERT INTO chats (id, user_id, title, topic_thread, created, updated) VALUES (%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET updated = NOW(), title = %s",
                              (chat_id, user_id, user_msg[:60], classify_query(user_msg), user_msg[:60]))
                    c.execute("INSERT INTO chat_messages (id, chat_id, user_id, role, content) VALUES (%s,%s,%s,%s,%s)",
                              (f"msg_{sid()}", chat_id, user_id, "user", user_msg))
                else:
                    c.execute("INSERT INTO chats (id, session_id, title, topic_thread, created, updated) VALUES (%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET updated = NOW(), title = %s",
                              (chat_id, session["id"], user_msg[:60], classify_query(user_msg), user_msg[:60]))
                    c.execute("INSERT INTO chat_messages (id, chat_id, session_id, role, content) VALUES (%s,%s,%s,%s,%s)",
                              (f"msg_{sid()}", chat_id, session["id"], "user", user_msg))
                conn.commit()
    except: pass

    chat_history = []
    try:
        with get_db() as conn:
            with conn.cursor() as c:
                c.execute("SELECT role, content FROM (SELECT role, content, created FROM chat_messages WHERE chat_id = %s ORDER BY created DESC LIMIT 60) recent ORDER BY created ASC", (chat_id,))
                chat_history = [{"role": r[0], "content": r[1]} for r in c.fetchall()]
    except: pass

    thread_context = get_thread_context(chat_id, user_id if is_authenticated else None, session["id"] if not is_authenticated else None)
    user_model = get_user_model(user_id) if is_authenticated else "Guest user."

    web_results_text = ""
    if needs_web_search(user_msg):
        try:
            results = search_web(user_msg, 5)
            if results: web_results_text = "\n".join([f"- {r['title']}: {r['snippet'][:200]}" for r in results[:4]])
        except: pass

    system_prompt = build_system_prompt(user_msg, user_model, thread_context, web_results_text)
    messages_for_ai = [{"role": "system", "content": system_prompt}] + chat_history
    response, model_used = call_ai_model(messages_for_ai)

    if response:
        msg_id = f"msg_{sid()}"
        close_burned = settings.BURN_PER_MESSAGE if is_authenticated else 0
        burn_tx_hash = None
        burn_success = True

        if is_authenticated:
            try:
                burn_tx_hash = burn_close_onchain(addr, priv, close_burned)
            except Exception as e:
                logger.error(f"On‑chain burn failed: {e}")
                burn_success = False
                close_burned = 0  # Don't deduct balance yet

        try:
            with get_db() as conn:
                with conn.cursor() as c:
                    if is_authenticated:
                        c.execute("INSERT INTO chat_messages (id, chat_id, user_id, role, content, model, close_burned) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                                  (msg_id, chat_id, user_id, "assistant", response, model_used, close_burned))
                        if burn_success and close_burned > 0:
                            c.execute("UPDATE users SET close_balance = GREATEST(0, close_balance - %s), last_active = NOW() WHERE id = %s",
                                      (close_burned, user_id))
                            c.execute("INSERT INTO close_transactions (id, user_id, type, amount, tx_hash) VALUES (%s,%s,%s,%s,%s)",
                                      (str(uuid.uuid4()), user_id, "burn", close_burned, burn_tx_hash))
                        elif not burn_success:
                            c.execute("INSERT INTO close_transactions (id, user_id, type, amount, tx_hash, status) VALUES (%s,%s,%s,%s,%s,%s)",
                                      (str(uuid.uuid4()), user_id, "burn_failed", settings.BURN_PER_MESSAGE, "", "pending"))
                        background_tasks.add_task(store_memory, user_id, response[:500], user_msg, classify_query(user_msg), 2)
                    else:
                        c.execute("INSERT INTO chat_messages (id, chat_id, session_id, role, content, model, close_burned) VALUES (%s,%s,%s,%s,%s,%s,0)",
                                  (msg_id, chat_id, session["id"], "assistant", response, model_used))
                    conn.commit()
        except Exception as e: logger.error(f"Save AI msg error: {e}")

        result = {"content": response, "chat_id": chat_id, "model": model_used, "message_id": msg_id}
        if is_authenticated:
            new_balance = close_balance - (close_burned if burn_success else 0)
            result["close_balance"] = max(0, new_balance)
            result["close_burned"] = close_burned if burn_success else 0
            result["burn_tx"] = burn_tx_hash
            if not burn_success:
                result["burn_error"] = "The burn transaction failed. Your balance has not been deducted. The transaction will be retried automatically."
            if new_balance < settings.BURN_PER_MESSAGE * 10:
                result["low_balance_warning"] = True
                result["wallet_message"] = f"Only {new_balance} CLOSE remaining. Top up to continue."
            background_tasks.add_task(dispatch_webhooks, user_id, "new_message", {
                "chat_id": chat_id,
                "message_id": msg_id,
                "role": "assistant",
                "content_preview": response[:200]
            }, background_tasks)
        else:
            remaining = settings.FREE_MESSAGES_GUEST - free_used
            result["free_messages_remaining"] = max(0, remaining)
            if remaining <= 1:
                result["wallet_prompt"] = True
                result["wallet_message"] = "Create your OS Wallet to get 500 CLOSE and unlock unlimited AI."
        return result

    return {"content": "I couldn't generate a response. Please try again.", "chat_id": chat_id, "model": "fallback"}

# ================================================================================
# HEALTH
# ================================================================================
@app.get("/health")
def health_check():
    return {"status":"ok","version":"38.1","edition":"Security Hardened – OS AI"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)