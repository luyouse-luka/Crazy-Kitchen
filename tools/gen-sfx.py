#!/usr/bin/env python3
"""Placeholder SFX, synthesised with the stdlib only so there is no licence to track.
Writes game/assets/resources/sfx/<name>.wav (22.05 kHz mono 16-bit). Re-run after tuning; swap for real audio in M6."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parent.parent / 'game/assets/resources/sfx'
random.seed(20260925)


def tone(f0, f1, sec, shape='sine', decay=6.0, vol=0.5):
    n = int(RATE * sec)
    out, ph = [], 0.0
    for i in range(n):
        t = i / n
        f = f0 + (f1 - f0) * t
        ph += 2 * math.pi * f / RATE
        if shape == 'sine':
            v = math.sin(ph)
        elif shape == 'square':
            v = 1.0 if math.sin(ph) >= 0 else -1.0
        else:
            v = 2 * ((ph / (2 * math.pi)) % 1) - 1
        attack = min(1.0, i / (RATE * 0.004))
        out.append(v * vol * attack * math.exp(-decay * t))
    return out


def noise(sec, decay=8.0, vol=0.4, smooth=0.0):
    n = int(RATE * sec)
    out, prev = [], 0.0
    for i in range(n):
        v = random.uniform(-1, 1)
        prev = prev * smooth + v * (1 - smooth)
        out.append(prev * vol * math.exp(-decay * i / n))
    return out


def mix(*parts):
    out = [0.0] * max(int(RATE * start) + len(p) for start, p in parts)
    for start, p in parts:
        o = int(RATE * start)
        for i, v in enumerate(p):
            out[o + i] += v
    return out


def seq(*notes):
    out = []
    for f, sec in notes:
        out += tone(f, f, sec, decay=3.0, vol=0.35)
    return out


SOUNDS = {
    'pick': tone(620, 940, 0.08, decay=4),
    'drop': tone(520, 300, 0.09, decay=4),
    'trash': mix((0, noise(0.18, decay=10, vol=0.35, smooth=0.6)), (0, tone(160, 90, 0.18, decay=6, vol=0.3))),
    'serve': mix((0, tone(1047, 1047, 0.22, decay=5, vol=0.35)), (0.08, tone(1319, 1319, 0.3, decay=5, vol=0.35))),
    'wrong': tone(190, 150, 0.32, shape='square', decay=3, vol=0.18),
    'deny': mix((0, tone(240, 240, 0.05, shape='square', decay=2, vol=0.15)), (0.07, tone(200, 200, 0.06, shape='square', decay=2, vol=0.15))),
    'burnt': mix((0, noise(0.6, decay=4, vol=0.3, smooth=0.3)), (0, tone(300, 120, 0.4, shape='saw', decay=5, vol=0.12))),
    'crash': mix(
        (0, noise(0.45, decay=7, vol=0.5)),
        (0.02, tone(2400, 2100, 0.12, decay=10, vol=0.2)),
        (0.09, tone(3100, 2800, 0.1, decay=10, vol=0.18)),
        (0.16, tone(2700, 2500, 0.1, decay=10, vol=0.15)),
    ),
    'ding': tone(1568, 1568, 0.45, decay=7, vol=0.35),
    'tap': tone(1200, 900, 0.035, decay=5, vol=0.3),
    'scrub': noise(0.14, decay=3, vol=0.18, smooth=0.85),
    'ready': mix((0, tone(988, 988, 0.12, decay=6, vol=0.3)), (0.1, tone(1319, 1319, 0.2, decay=6, vol=0.3))),
    'result': seq((523, 0.12), (659, 0.12), (784, 0.12), (1047, 0.35)),
}


def write(name, samples):
    peak = max(1e-9, max(abs(v) for v in samples))
    k = min(1.0, 0.9 / peak)
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v * k)) * 32767)) for v in samples))


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for name, s in SOUNDS.items():
        write(name, s)
    print(f'{len(SOUNDS)} files -> {OUT}')
