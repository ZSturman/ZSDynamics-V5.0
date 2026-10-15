#!/usr/bin/env python3
"""Preview the Next.js export with Firebase Hosting's clean URL behavior."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class ExportHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        translated = super().translate_path(path)
        clean_route = Path(translated + ".html")
        return str(clean_route) if clean_route.is_file() else translated


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent / "out"
    if not (root / "index.html").is_file():
        raise SystemExit("Run npm run build before previewing the export.")
    server = ThreadingHTTPServer(("127.0.0.1", 3001), partial(ExportHandler, directory=str(root)))
    print("Portfolio export: http://127.0.0.1:3001", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
