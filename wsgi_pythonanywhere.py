# +--------------------------------------------------------------------------+
# | CenterHub WSGI Adapter for PythonAnywhere (wookyunghub)                  |
# +--------------------------------------------------------------------------+
import sys
import os
from pathlib import Path
import io

project_home = '/home/wookyunghub/wookyunghub'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

os.chdir(project_home + '/public')

import server

# Initialize repository and server states
server.normalize_record_types(server.REPO, server.ROOT)
server.migrate_attendee_snapshots()
server.sync_public_organization()

class FakeSocket:
    def __init__(self, rfile_bytes):
        self._rfile = io.BytesIO(rfile_bytes)
        self._wfile = io.BytesIO()
    def makefile(self, mode='r', bufsize=-1):
        if 'r' in mode:
            return self._rfile
        return self._wfile

def application(environ, start_response):
    method = environ.get('REQUEST_METHOD', 'GET')
    path = environ.get('PATH_INFO', '/')
    query = environ.get('QUERY_STRING', '')
    if query:
        path = f"{path}?{query}"

    try:
        content_length = int(environ.get('CONTENT_LENGTH', 0) or 0)
    except ValueError:
        content_length = 0

    body = environ['wsgi.input'].read(content_length) if content_length > 0 else b''

    headers = [f"{method} {path} HTTP/1.1"]
    for key, val in environ.items():
        if key.startswith('HTTP_'):
            hdr_name = key[5:].replace('_', '-').title()
            headers.append(f"{hdr_name}: {val}")
        elif key in ('CONTENT_TYPE', 'CONTENT_LENGTH') and val:
            hdr_name = key.replace('_', '-').title()
            headers.append(f"{hdr_name}: {val}")
    headers.append("\r\n")

    raw_req = "\r\n".join(headers).encode('iso-8859-1') + body
    fake_sock = FakeSocket(raw_req)

    try:
        handler = server.Handler(fake_sock, (environ.get('REMOTE_ADDR', '127.0.0.1'), 80), None)
    except Exception:
        pass

    fake_sock._wfile.seek(0)
    response_data = fake_sock._wfile.read()

    sep = b"\r\n\r\n"
    if sep in response_data:
        head, body_out = response_data.split(sep, 1)
    else:
        head, body_out = response_data, b""

    status_line = "200 OK"
    resp_headers = []
    lines = head.decode('iso-8859-1', errors='replace').split("\r\n")
    if lines:
        parts = lines[0].split(" ", 2)
        if len(parts) >= 2:
            status_line = f"{parts[1]} {parts[2] if len(parts) > 2 else 'OK'}"
        for line in lines[1:]:
            if ": " in line:
                k, v = line.split(": ", 1)
                resp_headers.append((k, v))

    # Add CORS headers so Cloudflare wookyung.pages.dev can communicate seamlessly
    resp_headers.append(('Access-Control-Allow-Origin', '*'))
    resp_headers.append(('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS'))
    resp_headers.append(('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With'))
    resp_headers.append(('Access-Control-Allow-Credentials', 'true'))

    start_response(status_line, resp_headers)
    return [body_out]
