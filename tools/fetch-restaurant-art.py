"""Download pinned CC0 sources into the ignored conversion cache."""
import io
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'game/temp/art-swap'
CACHE.mkdir(parents=True, exist_ok=True)
REVISIONS = {
    'KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0': '153c8a7535b48237854cb54ff6890679f8c574d1',
    'KayKit-Game-Assets/KayKit-Furniture-Bits-1.0': '96d5930a8dbdb363409bbc2d3341718b00e17c9c',
}


def download(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


for repo, target in list(zip(list(REVISIONS)[:2], ['kaykit', 'furniture'])):
    revision = REVISIONS[repo]
    archive = zipfile.ZipFile(io.BytesIO(download('https://codeload.github.com/' + repo + '/zip/' + revision)))
    prefix = archive.namelist()[0]
    destination = CACHE / target / (repo.split('/')[-1] + '-main')
    for entry in archive.infolist():
        relative = Path(entry.filename.removeprefix(prefix))
        if entry.is_dir() or relative.is_absolute() or '..' in relative.parts:
            continue
        path = destination / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(archive.read(entry))

from fetch_adventurers import fetch
fetch()
print('Pinned source assets downloaded. Run python tools/import-restaurant-art.py next.')
