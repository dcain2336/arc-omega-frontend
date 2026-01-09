# api.py
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, Request, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Mongo / GridFS
from pymongo import MongoClient
import gridfs
from bson import ObjectId

from lib.secrets import admin_ok, bootstrap_secrets, resolve_presence, is_present
from lib.model_catalog import get_models
from lib.providers import PROVIDER_CALLERS, ProviderResult

from lib.memory_mongo import MemoryStore
from lib.tools_weather import tool_weather
from lib.tools_search import tool_web_search
from lib.tools_vision import tool_vision_analyze_bytes

APP_NAME = "arc-omega-backend"

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_last_tried: Dict[str, Any] = {"ts": None, "provider": None, "model": None, "error": None}
_bootstrap_info: Dict[str, Any] = {}

# Mongo globals
_mongo: Optional[MongoClient] = None
_db = None
_fs: Optional[gridfs.GridFS] = None

# Memory store (Mongo-backed if MONGO_URI is set)
_memory: Optional[MemoryStore] = None


@app.on_event("startup")
def _startup():
    global _bootstrap_info, _mongo, _db, _fs, _memory
    _bootstrap_info = bootstrap_secrets()

    mongo_uri = (os.environ.get("MONGO_URI") or "").strip()
    if mongo_uri:
        _mongo = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        db_name = os.getenv("MONGO_DB", "arc_omega")
        _db = _mongo.get_database(db_name)
        _fs = gridfs.GridFS(_db, collection="files")
        _mongo.admin.command("ping")
        _memory = MemoryStore(_db)


class QueryIn(BaseModel):
    message: str = Field(..., example="Hello ARC — quick test.")
    session_id: Optional[str] = Field(default="default", example="default")
    provider: Optional[str] = Field(default="auto", example="auto")
    model: Optional[str] = Field(default=None, example=None)

    debug: bool = Field(default=False, example=False)
    force_council: bool = Field(default=False, example=False)
    council_rounds: int = Field(default=2, ge=1, le=3, example=2)


@app.get("/")
def root():
    return {"ok": True, "app": APP_NAME, "ts": int(time.time() * 1000)}


@app.get("/ping")
def ping():
    return {"ok": True, "ts": int(time.time() * 1000)}


@app.get("/last_tried")
def last_tried():
    return _last_tried


@app.get("/keys")
def keys():
    return {"ok": True, "ts": int(time.time() * 1000), "keys": resolve_presence()}


@app.get("/keys/admin")
def keys_admin(request: Request):
    if not admin_ok(request):
        return {"ok": False, "error": "unauthorized"}
    present = [k for k, v in resolve_presence().items() if v]
    return {
        "ok": True,
        "ts": int(time.time() * 1000),
        "present_key_names": sorted(present),
        "bootstrap": _bootstrap_info,
    }


def _provider_key_present(provider: str) -> bool:
    provider = provider.lower().strip()
    mapping = {
        "openai": "OPENAI_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "groq": "GROQ_API_KEY",
        "huggingface": "HF_TOKEN",
        "anthropic": "ANTHROPIC_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "mistral": "MISTRAL_API_KEY",
        "perplexity": "PERPLEXITY_API_KEY",
    }
    key_name = mapping.get(provider)
    if not key_name:
        return False
    return is_present(key_name)


@app.get("/candidates")
def candidates():
    providers: Dict[str, Any] = {}
    for p in ["openai", "openrouter", "groq", "huggingface", "anthropic", "gemini", "mistral", "perplexity"]:
        providers[p] = {
            "key_present": _provider_key_present(p),
            "models": get_models(p),
            "callable": p in PROVIDER_CALLERS,
        }
    return {"ok": True, "ts": int(time.time() * 1000), "providers": providers}


# -----------------------------
# Tools: News (server-side)
# -----------------------------
@app.get("/tools/news")
def tools_news():
    # 1) NewsData.io
    nd_key = (os.environ.get("NEWSDATA_API_KEY") or os.environ.get("NEWSDATAIO_KEY") or "").strip()
    if nd_key:
        try:
            url = "https://newsdata.io/api/1/news"
            params = {"apikey": nd_key, "country": "us", "language": "en", "size": 12}
            r = requests.get(url, params=params, timeout=12)
            data = r.json()
            results = data.get("results") or []
            headlines = []
            for a in results:
                t = (a.get("title") or "").strip()
                if t:
                    headlines.append(t)
            if not headlines:
                headlines = ["No headlines right now"]
            return {"ok": True, "headlines": headlines}
        except Exception:
            return {"ok": True, "headlines": ["News unavailable"]}

    # 2) NewsAPI.org
    key = (os.environ.get("NEWSAPI_KEY") or "").strip()
    if key:
        try:
            url = "https://newsapi.org/v2/top-headlines"
            params = {"country": "us", "pageSize": 12}
            r = requests.get(url, params=params, headers={"X-Api-Key": key}, timeout=12)
            data = r.json()
            articles = data.get("articles") or []
            headlines = []
            for a in articles:
                t = (a.get("title") or "").strip()
                if t:
                    headlines.append(t)
            if not headlines:
                headlines = ["No headlines right now"]
            return {"ok": True, "headlines": headlines}
        except Exception:
            return {"ok": True, "headlines": ["News unavailable"]}

    return {"ok": True, "headlines": ["News unavailable (missing NEWSDATA_API_KEY / NEWSAPI_KEY)"]}


# -----------------------------
# Tools: Weather (server-side)
# -----------------------------
@app.get("/tools/weather")
def tools_weather(q: str = Query(default="Jacksonville, NC")):
    return tool_weather(q)


# -----------------------------
# Files: Mongo GridFS primary
# -----------------------------
def _fs_ready() -> bool:
    return _fs is not None and _db is not None


@app.get("/files")
def list_files():
    if not _fs_ready():
        return {"ok": False, "error": "Mongo/GridFS not configured (missing MONGO_URI?)"}

    files = []
    try:
        for f in _db["files.files"].find().sort("uploadDate", -1).limit(50):
            files.append(
                {
                    "id": str(f["_id"]),
                    "name": f.get("filename") or "file",
                    "size": int(f.get("length") or 0),
                    "uploaded": f.get("uploadDate").isoformat() if f.get("uploadDate") else None,
                    "contentType": f.get("contentType") or f.get("content_type"),
                }
            )
        return {"ok": True, "files": files}
    except Exception as e:
        return {"ok": False, "error": f"list failed: {e}"}


@app.post("/files")
async def upload_file_root(file: UploadFile = File(...)):
    return await _upload_file_impl(file)


@app.post("/files/upload")
async def upload_file_compat(file: UploadFile = File(...)):
    return await _upload_file_impl(file)


async def _upload_file_impl(file: UploadFile) -> Dict[str, Any]:
    if not _fs_ready():
        return {"ok": False, "error": "Mongo/GridFS not configured (missing MONGO_URI?)"}

    try:
        filename = os.path.basename(file.filename or "upload.bin")
        content = await file.read()
        file_id = _fs.put(
            content,
            filename=filename,
            contentType=file.content_type or "application/octet-stream",
            uploadedAt=datetime.utcnow(),
        )
        return {"ok": True, "id": str(file_id), "name": filename, "size": len(content)}
    except Exception as e:
        return {"ok": False, "error": f"upload failed: {e}"}


@app.get("/files/{file_id}")
def download_file(file_id: str):
    if not _fs_ready():
        return {"ok": False, "error": "Mongo/GridFS not configured (missing MONGO_URI?)"}

    try:
        oid = ObjectId(file_id)
        gf = _fs.get(oid)
        headers = {"Content-Disposition": f'attachment; filename="{gf.filename}"'}
        content_type = getattr(gf, "content_type", None) or getattr(gf, "contentType", None) or "application/octet-stream"
        return StreamingResponse(gf, media_type=content_type, headers=headers)
    except Exception:
        return {"ok": False, "error": "not found"}


def _latest_uploaded_image_bytes() -> Optional[Dict[str, Any]]:
    if not _fs_ready():
        return None

    try:
        for f in _db["files.files"].find().sort("uploadDate", -1).limit(80):
            ct = (f.get("contentType") or f.get("content_type") or "").lower().strip()
            fn = (f.get("filename") or "").lower()
            is_img = ct.startswith("image/") or fn.endswith((".png", ".jpg", ".jpeg", ".webp"))
            if not is_img:
                continue
            oid = f["_id"]
            gf = _fs.get(oid)
            data = gf.read()
            return {
                "id": str(oid),
                "bytes": data,
                "filename": gf.filename,
                "content_type": ct or "application/octet-stream",
            }
    except Exception:
        return None
    return None


# -----------------------------
# Vision endpoints
# -----------------------------
@app.get("/vision/last")
def vision_last(prompt: str = Query(default="Describe this image.")):
    item = _latest_uploaded_image_bytes()
    if not item:
        return {"ok": False, "error": "No recent image found (upload an image first)."}

    res = tool_vision_analyze_bytes(img_bytes=item["bytes"], content_type=item["content_type"], prompt=prompt)
    if not res.get("ok"):
        return res

    return {
        "ok": True,
        "file_id": item["id"],
        "filename": item["filename"],
        "content_type": item["content_type"],
        "analysis": res.get("text") or "",
        "provider": res.get("provider"),
        "model": res.get("model"),
    }


@app.get("/vision/{file_id}")
def vision_by_id(file_id: str, prompt: str = Query(default="Describe this image.")):
    if not _fs_ready():
        return {"ok": False, "error": "Mongo/GridFS not configured (missing MONGO_URI?)"}

    try:
        oid = ObjectId(file_id)
        gf = _fs.get(oid)
        data = gf.read()
        ct = getattr(gf, "content_type", None) or getattr(gf, "contentType", None) or "application/octet-stream"

        res = tool_vision_analyze_bytes(img_bytes=data, content_type=ct, prompt=prompt)
        if not res.get("ok"):
            return res

        return {
            "ok": True,
            "file_id": file_id,
            "filename": gf.filename,
            "content_type": ct,
            "analysis": res.get("text") or "",
            "provider": res.get("provider"),
            "model": res.get("model"),
        }
    except Exception:
        return {"ok": False, "error": "not found"}


# -----------------------------
# Council logs endpoints
# -----------------------------
@app.get("/council/last")
def council_last():
    if not _memory:
        return {"ok": True, "has_log": False, "error": "Memory not configured (missing MONGO_URI?)"}
    item = _memory.get_last_council_log()
    if not item:
        return {"ok": True, "has_log": False}
    return {"ok": True, "has_log": True, "session_id": item.get("session_id"), "created": item.get("created"), "events": item.get("events", [])}


@app.get("/council/{session_id}")
def council_by_session(session_id: str):
    if not _memory:
        return {"ok": False, "error": "Memory not configured (missing MONGO_URI?)"}
    item = _memory.get_council_log(session_id=session_id)
    if not item:
        return {"ok": False, "error": "No council log for that session."}
    return {"ok": True, "session_id": session_id, "events": item.get("events", [])}


# -----------------------------
# Provider fallback
# -----------------------------
def _call_with_fallback(user_text: str, requested_provider: str = "auto", forced_model: Optional[str] = None) -> Dict[str, Any]:
    global _last_tried

    provider_order = ["openai", "openrouter", "groq", "huggingface", "anthropic", "gemini", "mistral", "perplexity"]
    requested_provider = (requested_provider or "auto").lower().strip()

    if requested_provider != "auto":
        if requested_provider not in PROVIDER_CALLERS:
            return {"ok": False, "error": f"provider not supported: {requested_provider}", "attempts": []}
        provider_order = [requested_provider]

    attempts: List[Dict[str, Any]] = []

    def try_one(provider: str, model: str) -> ProviderResult:
        global _last_tried
        _last_tried = {"ts": int(time.time() * 1000), "provider": provider, "model": model, "error": None}
        res = PROVIDER_CALLERS[provider](user_text, model)
        if not res.ok:
            _last_tried["error"] = res.error
        return res

    for provider in provider_order:
        if provider not in PROVIDER_CALLERS:
            continue

        if not _provider_key_present(provider):
            attempts.append({"provider": provider, "skipped": True, "reason": "key missing"})
            continue

        models = get_models(provider)
        if forced_model:
            models = [forced_model]

        if not models:
            attempts.append({"provider": provider, "skipped": True, "reason": "no models configured"})
            continue

        for model in models:
            res = try_one(provider, model)
            if res.ok:
                return {"ok": True, "provider": provider, "model": model, "text": res.text, "attempts": attempts + [{"provider": provider, "model": model, "ok": True}]}

            attempts.append({"provider": provider, "model": model, "ok": False, "error": res.error, "upstream": res.upstream})

    return {"ok": False, "error": "no providers succeeded", "attempts": attempts}


# -----------------------------
# Council trigger (FIXED)
# -----------------------------
def _should_use_council(msg: str) -> bool:
    """
    Stronger trigger:
      - legal/permits/zoning/ordinances
      - construction/engineering/structural
      - shelter/bunker/fallout
      - tool-like asks (weather/news/web/image)
      - complexity score (length/clauses/questions)
    """
    text = (msg or "").strip()
    m = text.lower()

    # immediate tool triggers
    tool_hits = [
        "right now", "current", "latest", "today",
        "news", "headlines",
        "weather", "forecast",
        "search", "look up", "sources", "web", "internet",
        "image", "photo", "picture", "uploaded", "analyze", "describe this image",
    ]
    if any(w in m for w in tool_hits):
        return True

    # legal + build triggers
    hard_hits = [
        "permit", "permitting", "zoning", "ordinance", "code enforcement", "inspection",
        "onslow", "camp lejeune", "jacksonville nc", "north carolina",
        "structural", "engineering", "foundation", "load bearing", "rebar",
        "fallout shelter", "shelter", "bunker", "storm shelter", "safe room",
        "egress", "ventilation", "drainage", "septic", "setback",
    ]
    if any(w in m for w in hard_hits):
        return True

    # complexity score
    score = 0
    if len(text) >= 220:
        score += 2
    if len(text) >= 500:
        score += 2
    if text.count("?") >= 2:
        score += 2
    if any(w in m for w in ["step by step", "detailed", "comprehensive", "plan", "design"]):
        score += 2
    if any(w in m for w in ["and", "but", "however", "because", "whereas"]):
        score += 1

    return score >= 2


# -----------------------------
# Council runner (tools + debate)
# -----------------------------
def _run_council(user_msg: str, session_id: str, requested_provider: str, forced_model: Optional[str], rounds: int, debug: bool) -> Dict[str, Any]:
    events: List[Dict[str, Any]] = []

    def add_event(role: str, text: str = "", provider: str = "", model: str = "", tools: Any = None, error: str = ""):
        e: Dict[str, Any] = {"role": role, "text": text}
        if provider:
            e["provider"] = provider
        if model:
            e["model"] = model
        if tools is not None:
            e["tools"] = tools
        if error:
            e["error"] = error
        events.append(e)

    memory_block = ""
    if _memory:
        recent = _memory.get_recent_messages(session_id=session_id, limit=12)
        if recent:
            lines = []
            for r in recent:
                lines.append(f"{r.get('role','user').upper()}: {r.get('text','')}")
            memory_block = "\n".join(lines)

    m = (user_msg or "").lower()
    want_weather = "weather" in m or "forecast" in m
    want_news = "news" in m or "headlines" in m
    want_web = any(x in m for x in ["search", "look up", "latest", "right now", "current", "sources", "web", "internet", "permit", "zoning", "ordinance", "code", "inspection", "legal"])
    want_vision = any(x in m for x in ["image", "photo", "picture", "uploaded", "tell me about the picture", "describe the picture"])

    tool_outputs: Dict[str, Any] = {}

    try:
        if want_weather:
            tool_outputs["weather"] = tool_weather(user_msg)
        if want_news:
            tool_outputs["news"] = tools_news()
        if want_web:
            tool_outputs["web"] = tool_web_search(user_msg)
        if want_vision:
            item = _latest_uploaded_image_bytes()
            if item:
                v = tool_vision_analyze_bytes(img_bytes=item["bytes"], content_type=item["content_type"], prompt=user_msg)
                tool_outputs["vision"] = {"file_id": item["id"], "filename": item["filename"], "content_type": item["content_type"], "result": v}
            else:
                tool_outputs["vision"] = {"ok": False, "error": "No recent image found (upload an image first)."}

        add_event("TOOLS", text="Tools executed", tools=tool_outputs)
    except Exception as e:
        add_event("TOOLS", text="Tool execution failed", error=str(e), tools=tool_outputs)

    context_parts: List[str] = []
    context_parts.append("You are ARC-OMEGA Council. Do NOT mention internal roles.")
    context_parts.append("Be accurate, practical, and structured. If tools are available, incorporate them clearly.")
    if memory_block:
        context_parts.append("SESSION MEMORY (recent):\n" + memory_block)
    if tool_outputs:
        context_parts.append("TOOLS OUTPUTS (JSON):\n" + str(tool_outputs))

    # Graceful fallback hint for vision failures
    if isinstance(tool_outputs.get("vision"), dict):
        vr = tool_outputs["vision"].get("result") if "result" in tool_outputs["vision"] else tool_outputs["vision"]
        if isinstance(vr, dict) and vr.get("ok") is False:
            context_parts.append(
                "VISION NOTE:\n"
                "If image analysis failed due to quotas/credits, do NOT stop. "
                "Provide best-effort help by asking the user for a short description of what the image shows "
                "and what they want extracted, then propose next steps."
            )

    context_parts.append("USER REQUEST:\n" + user_msg)
    base_context = "\n\n".join(context_parts)

    def council_step(role: str, instruction: str) -> Dict[str, Any]:
        prompt = f"{base_context}\n\nROLE: {role}\nTASK: {instruction}\n"
        out = _call_with_fallback(prompt, requested_provider=requested_provider, forced_model=forced_model)
        add_event(role, text=out.get("text") or "", provider=out.get("provider") or "", model=out.get("model") or "", error=out.get("error") or "")
        return out

    proposer = council_step("PROPOSER", "Draft the best answer. If tools are available, incorporate them.")
    council_step("CRITIC", "Find mistakes, missing steps, risks, and improvements. Be specific.")

    revised_text = proposer.get("text") or ""
    for _ in range(max(1, rounds) - 1):
        reviser = council_step("REVISER", "Revise the answer to address CRITIC feedback. Output the improved answer.")
        if reviser.get("ok"):
            revised_text = reviser.get("text") or revised_text

    final = council_step("FINAL", "Return ONLY the final user-facing answer. No role talk. Mention tools used if relevant.")
    final_text = (final.get("text") or "").strip() or revised_text.strip()

    if _memory:
        _memory.save_council_log(session_id=session_id, events=events)

    return {"ok": bool(final_text), "text": final_text, "events": events}


# -----------------------------
# Query endpoint
# -----------------------------
@app.post("/query")
def query(q: QueryIn):
    msg = (q.message or "").strip()
    if not msg:
        return {"ok": False, "error": "empty message"}

    session_id = (q.session_id or "default").strip() or "default"
    requested_provider = (q.provider or "auto").lower().strip()

    if _memory:
        _memory.add_message(session_id=session_id, role="user", text=msg)

    use_council = bool(q.force_council) or _should_use_council(msg)

    if use_council:
        out = _run_council(
            user_msg=msg,
            session_id=session_id,
            requested_provider=requested_provider,
            forced_model=q.model,
            rounds=q.council_rounds or 2,
            debug=q.debug,
        )
        if _memory:
            _memory.add_message(session_id=session_id, role="assistant", text=out.get("text") or "")

        resp: Dict[str, Any] = {
            "ok": out.get("ok"),
            "ts": int(time.time() * 1000),
            "provider": "council",
            "model": q.model,
            "text": out.get("text") or "",
            "council_session_id": session_id,
        }
        if q.debug:
            resp["council"] = out.get("events", [])
        return resp

    out = _call_with_fallback(msg, requested_provider=requested_provider, forced_model=q.model)
    if out.get("ok"):
        if _memory:
            _memory.add_message(session_id=session_id, role="assistant", text=out.get("text") or "")
        return {
            "ok": True,
            "ts": int(time.time() * 1000),
            "provider": out.get("provider"),
            "model": out.get("model"),
            "text": out.get("text"),
            "attempts": out.get("attempts", []),
            "council_session_id": session_id,
        }

    return {
        "ok": False,
        "ts": int(time.time() * 1000),
        "provider": None,
        "model": None,
        "text": None,
        "error": out.get("error") or "no providers succeeded",
        "attempts": out.get("attempts", []),
        "council_session_id": session_id,
    }