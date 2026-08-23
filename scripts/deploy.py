#!/usr/bin/env python3
"""Direct-upload deploy of ./out to Cloudflare Pages (mirrors wrangler's flow)."""
import base64, json, mimetypes, os, urllib.request
import blake3

ACCOUNT = "0cfc4960bed47bee0b6226bc908c21ed"
PROJECT = "deal"
API = "https://api.cloudflare.com/client/v4"
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]

def req(path, token, payload=None, form=None):
    data = None
    headers = {"Authorization": f"Bearer {token}"}
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    elif form is not None:
        boundary = "----dealdeploy42"
        body = b""
        for k, v in form.items():
            body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode()
        body += f"--{boundary}--\r\n".encode()
        data = body
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    r = urllib.request.Request(API + path, data=data, headers=headers)
    with urllib.request.urlopen(r, timeout=180) as resp:
        return json.loads(resp.read())

def pages_hash(path):
    raw = open(path, "rb").read()
    b64 = base64.b64encode(raw).decode()
    ext = os.path.splitext(path)[1].lstrip(".")
    return blake3.blake3((b64 + ext).encode()).hexdigest()[:32]

def content_type(web):
    ct = mimetypes.guess_type(web)[0]
    overrides = {".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
                 ".webp": "image/webp", ".txt": "text/plain", ".ico": "image/x-icon",
                 ".json": "application/json", ".html": "text/html", ".png": "image/png",
                 ".woff2": "font/woff2", ".map": "application/json"}
    return overrides.get(os.path.splitext(web)[1], ct or "application/octet-stream")

# 1. collect files
files = {}
for root, _, names in os.walk("out"):
    for n in names:
        p = os.path.join(root, n)
        web = "/" + os.path.relpath(p, "out").replace(os.sep, "/")
        files[web] = {"path": p, "hash": pages_hash(p)}
print(f"{len(files)} files", flush=True)

# 2. upload token (project-scoped, GET with API token)
jwt = req(f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/upload-token", TOKEN)["result"]["jwt"]
print("got upload token", flush=True)

# 3. check missing
hashes = sorted({f["hash"] for f in files.values()})
missing = set(hashes)  # force-upload all for consistency
print(f"{len(missing)} missing of {len(hashes)}", flush=True)

# 4. upload missing in batches (~40MB cap; our files are tiny, batch by count)
to_upload = []
for f in files.values():
    if f["hash"] in missing:
        raw = open(f["path"], "rb").read()
        to_upload.append({
            "key": f["hash"],
            "value": base64.b64encode(raw).decode(),
            "metadata": {"contentType": content_type(f["path"])},
            "base64": True,
        })
for i in range(0, len(to_upload), 40):
    req("/pages/assets/upload", jwt, to_upload[i:i+40])
    print(f"uploaded {min(i+40, len(to_upload))}/{len(to_upload)}", flush=True)

# 5. create deployment
manifest = {web: f["hash"] for web, f in files.items()}
res = req(f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/deployments", TOKEN, form={
    "manifest": json.dumps(manifest),
    "branch": "main",
    "commit_dirty": "true",
    "commit_message": "Deploy Deal - AI tool offers directory",
})
print("DEPLOYED:", res.get("result", {}).get("url") or res, flush=True)
