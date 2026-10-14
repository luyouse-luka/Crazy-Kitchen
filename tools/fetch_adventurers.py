"""Fetch only the official zero-price Adventurers 2.0 archive."""
import hashlib
import http.cookiejar
import io
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'game/temp/adventurers'
URL = 'https://kaylousberg.itch.io/kaykit-adventurers'
SHA256 = 'abe48f4763fba0896bab486ee9e6d08ca6b5b3884b9601f235c8847ae94dc479'


def fetch():
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / 'Free-2.0.zip'
    if not archive.exists():
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

        def post(url, html):
            token = re.search(r'name="csrf_token" value="([^"]+)', html).group(1)
            request = urllib.request.Request(url, data=urllib.parse.urlencode({'csrf_token': token}).encode(),
                                             headers={'Referer': URL, 'X-Requested-With': 'XMLHttpRequest'})
            return json.load(opener.open(request, timeout=60))

        html = opener.open(URL, timeout=60).read().decode()
        html = opener.open(post(URL + '/download_url', html)['url'], timeout=60).read().decode()
        card = next(card for card in html.split('<div class="upload">') if 'title="Free 2.0"' in card)
        upload = re.search(r'data-upload_id="(\d+)"', card).group(1)
        link = post(URL + '/file/' + upload + '?source=game_download', html)['url']
        archive.write_bytes(opener.open(link, timeout=60).read())
    payload = archive.read_bytes()
    if hashlib.sha256(payload).hexdigest() != SHA256:
        raise ValueError('Adventurers archive changed; review the new version before importing')
    destination = CACHE / 'source'
    with zipfile.ZipFile(io.BytesIO(payload)) as source:
        for entry in source.infolist():
            relative = Path(entry.filename)
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('Unsafe archive path')
        source.extractall(destination)
    print('Official KayKit Adventurers Free 2.0 verified:', SHA256)


if __name__ == '__main__':
    fetch()
