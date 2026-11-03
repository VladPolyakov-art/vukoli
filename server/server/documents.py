"""Reading CVs and job postings from pasted text, files (PDF, DOCX, TXT, MD, HTML) and links."""
from __future__ import annotations

import base64
import html
import io
import ipaddress
import re
import socket
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_PAGE_BYTES = 3 * 1024 * 1024
MAX_TEXT = 20000


class DocumentError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def strip_html(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr)>", "\n", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def _host_is_public(host: str) -> bool:
    """Refuse localhost and private, link-local or reserved addresses (SSRF guard)."""
    if not host or host.lower() in ("localhost",) or host.lower().endswith((".localhost", ".local", ".internal")):
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast \
                or ip.is_unspecified:
            return False
    return True


def check_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise DocumentError("url_invalid", "Use a link that starts with http:// or https://.")
    if not _host_is_public(parsed.hostname):
        raise DocumentError("url_not_allowed", "This link points to a local or private address.")
    return url


def read_url(url: str, *, transport: httpx.BaseTransport | None = None, resolve: bool = True) -> str:
    """Fetch a job posting page and return readable text. Follows up to 5 redirects, each checked."""
    current = url.strip()
    with httpx.Client(timeout=15, follow_redirects=False, transport=transport,
                      headers={"User-Agent": "InterviewCoach/0.1 (+local app)", "Accept-Language": "en"}) as client:
        for _ in range(6):
            if resolve:
                check_url(current)
            elif urlparse(current).scheme not in ("http", "https"):
                raise DocumentError("url_invalid", "Use a link that starts with http:// or https://.")
            try:
                with client.stream("GET", current) as response:
                    if response.is_redirect and response.headers.get("location"):
                        current = urljoin(current, response.headers["location"])
                        continue
                    response.raise_for_status()
                    body = b""
                    for chunk in response.iter_bytes():
                        body += chunk
                        if len(body) > MAX_PAGE_BYTES:
                            break
                    encoding = response.encoding or "utf-8"
            except httpx.HTTPError as exc:
                raise DocumentError("url_unreachable",
                                    "Could not open the link. Copy the job posting text and paste it instead.") from exc
            text = strip_html(body.decode(encoding, errors="replace"))
            if len(text) < 300:
                raise DocumentError("url_empty", "The page is almost empty (it may need a login). "
                                                 "Copy the job posting text and paste it instead.")
            return text[:MAX_TEXT]
    raise DocumentError("url_unreachable", "Too many redirects.")


def _docx_text(data: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(data))
    parts = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def read_file(name: str, data_b64: str) -> str:
    try:
        data = base64.b64decode(data_b64, validate=True)
    except ValueError as exc:
        raise DocumentError("file_invalid", "The file could not be decoded.") from exc
    if len(data) > MAX_FILE_BYTES:
        raise DocumentError("file_too_large", "The file is larger than 8 MB.")
    suffix = Path(name).suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader
        try:
            text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(data)).pages[:20])
        except Exception as exc:
            raise DocumentError("file_unreadable", "Could not read the PDF.") from exc
    elif suffix == ".docx":
        try:
            text = _docx_text(data)
        except Exception as exc:
            raise DocumentError("file_unreadable", "Could not read the Word document.") from exc
    elif suffix in (".html", ".htm"):
        text = strip_html(data.decode("utf-8", errors="replace"))
    elif suffix in (".txt", ".md", ".markdown", ""):
        text = data.decode("utf-8", errors="replace")
    else:
        raise DocumentError("file_unsupported", "Supported files: PDF, DOCX, TXT, MD and HTML.")
    text = text.strip()
    if len(text) < 100:
        raise DocumentError("file_empty", "The file has almost no text.")
    return text[:MAX_TEXT]


# ---------- known terms (names the language check must not rewrite) ----------
# A token is a "term" when it looks like a name: internal capitals (PostgreSQL, iOS), an acronym (AWS, B2B), a
# `.js` / `.io` / `.ai` name, or a capitalised word that is not an ordinary English word. The last kind is the greedy
# one (CV bullets start with "Designed", "Built"; titles read "Native Design Lead"), so it needs three tests:
# the word must not be on the common list, must not also appear in lowercase in the same texts, and must be
# capitalised somewhere other than the start of a sentence or line.
NAME_LIKE = re.compile(
    r"(?<![\w.])(?:[A-Za-z][A-Za-z0-9]*\.(?:js|io|ai)|[a-z]+[A-Z]\w*|[A-Z][a-z]+[A-Z]\w*|[A-Z]+[0-9][A-Z0-9]*"
    r"|[A-Z]{2,}[a-z]?s?)(?!\w)")
CAP_WORD = re.compile(r"(?<![\w.])[A-Z][a-z]{2,}(?!\w|\.(?:js|io|ai)\b)")
CEFR = re.compile(r"[A-C][12]")
LOWER_WORD = re.compile(r"(?<![\w.])[a-z]{3,}(?!\w)")
SENTENCE_START = ".!?:;\n\u2022\u00b7\u25aa\u25cf\u25a0-\u2013\u2014*|/("
COMMON_WORDS = frozenset("""
the this that with and for you your our we they what when where who how why from into about over under across through
experience requirements responsibilities role team work skills education summary senior junior lead present
january february march april may june july august september october november december
monday tuesday wednesday thursday friday saturday sunday must nice have plus bonus
design designer designers native product products manager managers engineer engineers developer developers
development research researcher analyst consultant director head principal staff intern freelance remote hybrid
company companies project projects portfolio profile contact summary objective language languages english russian
polish german french spanish certificates certification courses course awards award interests hobbies volunteer
mobile web app apps platform platforms system systems service services software hardware data digital interface
user users customer customers client clients business market marketing sales growth strategy planning
management leadership communication collaboration creative visual interaction experience prototype prototyping
home study park run workout hub logistics studio group labs lab agency university school college institute bachelor
master degree present current previous full part time years year months month weeks week days day
built designed added served acted structured focused reduced conducted created redesigned defended modernized
led managed worked developed delivered improved increased launched owned drove shipped wrote tested analyzed
introduced established coordinated implemented maintained organized supported trained mentored
new good great best high low open free open source public private first second third last next more most
some any all each every other another such only also both either neither
jan feb mar apr jun jul aug sep sept oct nov dec
auto layout surfaces literacy validation craft material tools tool process quality testing content
""".split())


def _sentence_start(text: str, at: int) -> bool:
    before = text[:at].rstrip(" \t")
    return not before or before[-1] in SENTENCE_START


def known_terms(*texts: str, limit: int = 60) -> list[str]:
    """Product, tool and company names from the user's own CV / JD. The language check keeps them as written; it does
    not drop a correction because a quote mentions one (see feedback.validate_language_items)."""
    joined = "\n".join(t or "" for t in texts)
    lowered = set(LOWER_WORD.findall(joined))
    seen: dict[str, None] = {}
    for match in NAME_LIKE.finditer(joined):
        word = match.group(0)
        if word.isupper() and len(word) >= 5 and (word.lower() in COMMON_WORDS or word.lower() in lowered):
            continue                                   # a SHOUTED heading, not an acronym
        if CEFR.fullmatch(word):
            continue                                   # a language level (B2), not a product
        seen.setdefault(word)
    for match in CAP_WORD.finditer(joined):
        word = match.group(0)
        low = word.lower()
        if word in seen or low in COMMON_WORDS or low in lowered or _sentence_start(joined, match.start()):
            continue
        seen[word] = None
    return list(seen)[:limit]


def _word_pattern(term: str) -> re.Pattern:
    return re.compile(r"(?<!\w)" + re.escape(term) + r"(?!\w)")


def terms_in(text: str, known) -> list[str]:
    """The known terms that stand in `text` as whole words, spelled exactly like that (case counts)."""
    return [t for t in dict.fromkeys(known or []) if t and _word_pattern(t).search(text or "")]
