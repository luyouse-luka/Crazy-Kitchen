import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


parser = argparse.ArgumentParser(description='Serve a Cocos preview on localhost.')
parser.add_argument('directory', type=Path)
parser.add_argument('--port', type=int, default=4195)
args = parser.parse_args()
directory = args.directory.resolve(strict=True)
if not (directory / 'index.html').is_file():
    parser.error('The preview directory must contain index.html')
server = PreviewServer(('127.0.0.1', args.port), partial(PreviewHandler, directory=str(directory)))
print(f'Preview: http://127.0.0.1:{args.port}', flush=True)
server.serve_forever()
