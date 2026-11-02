#!/usr/bin/env python3
"""AI Code Review GitHub Action (MVP).

Reads a unified PR diff, sends the reviewable portion to the DeepSeek API,
validates the returned findings against the actual diff (guards against
hallucinated files/lines), and posts them as GitHub PR review comments —
inline where possible, otherwise in the review summary.

Uses only the Python standard library (no `pip install` needed).
Exit codes: 0 = handled gracefully (success or contained failure),
            1 = cannot proceed at all (e.g. missing diff file).
"""

import json
import os
import re
import sys
import traceback
import urllib.error
import urllib.request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DIFF_FILE = sys.argv[1] if len(sys.argv) > 1 else "pr.diff"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
PR_NUMBER = int(os.environ.get("PR_NUMBER", "0") or 0)
REPO = os.environ.get("REPO", "")
IS_FORK = os.environ.get("FORK", "false").lower() == "true"

GITHUB_API = "https://api.github.com"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

MAX_TOTAL_DIFF_LINES = 1500   # cap on diff lines sent to the model
MAX_FILE_DIFF_LINES = 500     # hard cap per file
MAX_COMMENTS = 15             # max inline review comments
MAX_SUMMARY_ITEMS = 20        # max findings listed in the summary body
HTTP_TIMEOUT = 120

REVIEWABLE_EXTS = {".js", ".jsx", ".ts", ".tsx", ".css", ".scss", ".json", ".html"}
SKIP_FILE_PATTERNS = (
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "node_modules/", "dist/", "build/", "coverage/",
    ".min.", "__snapshots__/",
)

# Patterns removed from the diff before it is sent to the AI API.
SECRET_REDACTIONS = [
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{10,}\b"), "<REDACTED-KEY>"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"), "<REDACTED-GH-TOKEN>"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "<REDACTED-AWS-KEY>"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "<REDACTED-PEM>"),
    (re.compile(
        r"(?i)\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*[\"'][^\"']{8,}[\"']"
    ), r'\1: "<REDACTED>"'),
]

SYSTEM_PROMPT = """You are a senior frontend code reviewer for a React 18 + Vite 5 + TailwindCSS + react-router project.
Review the provided unified diff. Focus on, in priority order:
1. Bugs and logic errors
2. Security issues (XSS, injection, exposed secrets, unsafe patterns)
3. Performance problems (unnecessary re-renders, missing list keys, heavy work in render)
4. React anti-patterns (rules-of-hooks violations, missing effect dependencies, stale closures)
5. Maintainability, but only when clearly significant

Rules:
- Only comment on added or changed lines.
- Ignore whitespace, formatting, and pure styling preferences.
- Never reference code that is not visible in the diff.
- Be concise: 1-4 sentences per finding.

Respond with a JSON object exactly in this shape:
{
  "summary": "one short paragraph giving the overall assessment",
  "findings": [
    {
      "file": "src/path/file.jsx",
      "line": <line number in the NEW version of the file>,
      "severity": "high" | "medium" | "low",
      "category": "bug" | "security" | "performance" | "react" | "style" | "other",
      "comment": "what the problem is and how to fix it"
    }
  ]
}
If there are no significant issues, return {"summary": "...", "findings": []}."""

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
SEVERITY_ICON = {"high": "\U0001F534", "medium": "\U0001F7E0", "low": "\U0001F7E1"}


class FileDiff:
    """One file extracted from a unified diff."""

    def __init__(self, filename):
        self.filename = filename
        self.raw_lines = []   # raw unified-diff lines for this file
        self.added = {}       # new-file line number -> added code line

    @property
    def ext(self):
        return os.path.splitext(self.filename)[1].lower()


# ---------------------------------------------------------------------------
# Unified diff parsing
# ---------------------------------------------------------------------------
def parse_diff(diff_text):
    """Parse a unified diff into FileDiff objects.

    `added` maps new-file line numbers to the exact added source lines so that
    findings can later be validated before posting inline comments.
    """
    files = {}
    pending = None    # file we have seen `diff --git` for but not `+++` yet
    current = None
    new_line = None   # current line counter on the "+" side (None = outside hunk)

    def reset_pending(a=None, b=None):
        nonlocal pending, current, new_line
        pending = (a, b)
        current = None
        new_line = None

    for raw in diff_text.splitlines():
        if raw.startswith("diff --git "):
            m = re.match(r"^diff --git a/(.+?) b/(.+?)$", raw)
            reset_pending(*(m.groups() if m else (None, None)))
            continue
        if raw.startswith("--- "):
            if pending:
                pending = (None if pending[0] == "/dev/null" else pending[0], pending[1])
            continue
        if raw.startswith("+++ "):
            target = raw[4:].split("\t")[0].strip()
            if target == "/dev/null" or target.startswith("b/dev/null"):
                reset_pending()  # deleted file — nothing to review
                continue
            fname = (pending[1] if pending and pending[1] else
                     target[2:] if target.startswith("b/") else target)
            current = FileDiff(fname)
            files[fname] = current
            reset_pending()
            current = files[fname]
            continue

        if current is None:
            continue
        if raw.startswith("index ") or raw.startswith("similarity ") \
                or raw.startswith("rename ") or raw.startswith("old mode") \
                or raw.startswith("new mode") or raw.startswith("new file mode"):
            continue

        if raw.startswith("@@"):
            m = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", raw)
            if m:
                new_line = int(m.group(1))
            current.raw_lines.append(raw)
            continue

        if new_line is not None:
            current.raw_lines.append(raw)
            if raw.startswith("+"):
                current.added[new_line] = raw[1:]
                new_line += 1
            elif raw.startswith("-") or raw.startswith("\\"):
                pass
            else:
                new_line += 1

    return list(files.values())


# ---------------------------------------------------------------------------
# Diff preparation (filter / truncate / redact)
# ---------------------------------------------------------------------------
def is_reviewable(fd):
    if fd.ext not in REVIEWABLE_EXTS:
        return False
    path = fd.filename.lower()
    for pattern in SKIP_FILE_PATTERNS:
        if pattern in path:
            return False
    return bool(fd.added)


def redact(text):
    for pattern, replacement in SECRET_REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


def build_model_diff(files):
    """Assemble the diff text for the model under the global line budget."""
    reviewable = [fd for fd in files if is_reviewable(fd)]
    budget = MAX_TOTAL_DIFF_LINES
    parts = []
    for fd in reviewable:
        allowed = min(len(fd.raw_lines), MAX_FILE_DIFF_LINES, budget)
        if allowed <= 0:
            fd.truncated = True
            continue
        chunk = fd.raw_lines[:allowed]
        if allowed < len(fd.raw_lines):
            chunk += [f"(truncated — {len(fd.raw_lines) - allowed} more diff lines hidden)"]
        parts.append(f"\n===== {fd.filename} =====\n" + redact("\n".join(chunk)))
        budget -= allowed
    return "\n".join(parts), reviewable


# ---------------------------------------------------------------------------
# HTTP helpers (stdlib only)
# ---------------------------------------------------------------------------
def http_json(url, payload=None, headers=None, method=None, ok_codes=()):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json",
                 "User-Agent": "ai-review-action",
                 **(headers or {})},
        method=method or ("POST" if data is not None else "GET"),
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as res:
            body = res.read().decode()
            return json.loads(body) if body else {}, res.status
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors="replace")[:500]
        if err.code in ok_codes:
            return {}, err.code
        raise RuntimeError(f"HTTP {err.code} on {url}: {detail}") from None


# ---------------------------------------------------------------------------
# DeepSeek call
# ---------------------------------------------------------------------------
def call_deepseek(diff_text):
    payload = {
        "model": MODEL,
        "temperature": 0.2,
        "max_tokens": 4000,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",
             "content": ("Review this pull request diff. Every finding must point "
                         "to a file and line that actually appears in the diff.\n\n"
                         "```diff\n" + diff_text + "\n```")},
        ],
    }
    body, _ = http_json(
        DEEPSEEK_URL,
        payload,
        headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
    )
    content = body["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


# ---------------------------------------------------------------------------
# Validation & posting
# ---------------------------------------------------------------------------
def validate_findings(model_out, reviewable):
    """Keep only findings whose file/line exist in the diff; clamp the rest."""
    files = {fd.filename: fd for fd in reviewable}
    inline, summary_extra = [], []
    for f in model_out.get("findings", []):
        path = (f.get("file") or "").replace("\\", "/").lstrip("./")
        fd = files.get(path)
        severity = f.get("severity") if f.get("severity") in SEVERITY_ORDER else "low"
        comment = (f.get("comment") or "")[:1200]
        if not comment:
            continue
        if fd is None:
            summary_extra.append((severity, f"**{path}** — {comment}"))
            continue
        try:
            line = int(f.get("line"))
        except (TypeError, ValueError):
            line = None
        if line not in fd.added:
            nearest = min(fd.added, key=lambda n: abs(n - line)) if line and fd.added else None
            if nearest is not None and abs(nearest - (line or 10**9)) <= 5:
                line = nearest
            else:
                summary_extra.append((severity, f"**{path}** — {comment}"))
                continue
        inline.append({"file": path, "line": line, "severity": severity,
                       "category": (f.get("category") or "other").strip(),
                       "comment": comment})
    inline.sort(key=lambda x: (SEVERITY_ORDER[x["severity"]], x["file"], x["line"]))
    summary_extra.sort(key=lambda s: SEVERITY_ORDER.get(s[0], 9))
    return inline, summary_extra


def fmt_inline(f):
    icon = SEVERITY_ICON[f["severity"]]
    return (f"**{icon} AI Review — {f['severity'].upper()}** `{f['category']}`\n\n"
            f"{f['comment']}\n\n<sub>AI-generated suggestion — please verify before approving.</sub>")


def fmt_summary(model_sum, inline, summary_extra, stats):
    lines = ["## 🤖 AI Code Review", "",
             model_sum or "No overall assessment provided.", "",
             f"_{stats}_", ""]
    if inline:
        lines.append(f"**{len(inline)} finding(s)** posted as inline comments "
                     f"({len(summary_extra)} more file-level notes below).")
    if summary_extra:
        lines.append("\n### Findings not tied to a specific added line")
        for severity, text in summary_extra[:MAX_SUMMARY_ITEMS]:
            icon = SEVERITY_ICON.get(severity, "\U0001F4A1")
            lines.append(f"- {icon} ({severity}) {text[:500]}")
    return "\n".join(lines)[:60000]


def post_review(inline, summary_body):
    comments = [{"path": f["file"], "line": f["line"], "body": fmt_inline(f)}
                for f in inline[:MAX_COMMENTS]]
    payload = {"event": "COMMENT", "body": summary_body, "comments": comments}
    _, status = http_json(
        f"{GITHUB_API}/repos/{REPO}/pulls/{PR_NUMBER}/reviews", payload,
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        ok_codes=(403, 404, 422),
    )
    return status == 200


def post_issue_comment(body):
    _, status = http_json(
        f"{GITHUB_API}/repos/{REPO}/issues/{PR_NUMBER}/comments", {"body": body},
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        ok_codes=(403, 404, 422),
    )
    return status == 200


def notice(text):
    """Post a plain notice comment; log if GitHub posting is unavailable."""
    if PR_NUMBER and REPO and post_issue_comment(text):
        return
    print(text)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if PR_NUMBER and IS_FORK:
        # Forked PRs receive no secrets by design (GitHub security model).
        notice("🤖 **AI review skipped** — this PR comes from a fork, so the "
               "workflow cannot access `DEEPSEEK_API_KEY`. A maintainer can run "
               "it from the fork's upstream or merge locally and re-push.")
        return 0
    if not DEEPSEEK_API_KEY:
        notice("🤖 **AI review skipped** — `DEEPSEEK_API_KEY` secret is not set in "
               "this repository (Settings → Secrets and variables → Actions).")
        return 0

    if not os.path.exists(DIFF_FILE):
        print(f"Diff file not found: {DIFF_FILE}", file=sys.stderr)
        return 1

    with open(DIFF_FILE, encoding="utf-8", errors="replace") as fh:
        diff_text = fh.read()

    files = parse_diff(diff_text)
    model_diff, reviewable = build_model_diff(files)
    if not model_diff.strip():
        print("No reviewable JS/CSS changes in this PR.")
        return 0

    model_out = call_deepseek(model_diff)
    inline, summary_extra = validate_findings(model_out, reviewable)
    stats = (f"{len(reviewable)} file(s) reviewed · "
             f"{len(inline)} inline finding(s) · {len(summary_extra)} general note(s)")
    summary_body = fmt_summary(model_out.get("summary"), inline, summary_extra, stats)

    if inline and post_review(inline, summary_body):
        print(f"Posted review: {len(inline)} inline comments.")
    elif post_issue_comment(summary_body):
        print("Posted summary comment only.")
    else:
        print(summary_body)  # last resort: dump to the workflow log
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001 — keep the check green, surface the error
        traceback.print_exc()
        try:
            notice("\U0001F916 **AI review failed** — an unexpected error occurred "
                   "while reviewing this PR. Check the workflow run logs for details.")
        except Exception:  # noqa: BLE001 — never crash the workflow for notice failure
            pass
        sys.exit(0)
