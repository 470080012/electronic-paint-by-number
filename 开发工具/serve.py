#!/usr/bin/env python3
"""Local-only development server; Python standard library, no runtime install."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import threading
import webbrowser

parser = argparse.ArgumentParser(description='数字油画工作室本地运行')
parser.add_argument('--port', type=int, default=4198)
parser.add_argument('--bind', default='127.0.0.1')
parser.add_argument('--no-open', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent / '源文件'
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('X-Digital-Oil-Studio', '0.1')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
server = None
for port in range(args.port, args.port + 11):
    try:
        server = ThreadingHTTPServer((args.bind, port), partial(Handler, directory=str(root)))
        break
    except OSError:
        continue
if server is None:
    raise SystemExit('端口暂时不可用，请指定 --port 其他端口')
base = f'http://127.0.0.1:{server.server_port}/'
print(f'数字油画工作室\n图库：{base}\n照片转换：{base}?view=maker\n四图测试：{base}?test=1\n按 Ctrl+C 退出。', flush=True)
if not args.no_open:
    threading.Timer(0.8, lambda: webbrowser.open(base + '?view=maker')).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
