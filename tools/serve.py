# Dev server: same as `python3 -m http.server 5199`, but tells the browser never to cache (so edits show on reload).
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
http.server.ThreadingHTTPServer(('', 5199), functools.partial(H, directory='.')).serve_forever()
