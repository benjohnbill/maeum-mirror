r"""Synthesize a lo-fi background track for the demo video.

Pure numpy synthesis: no samples, so no license or Content ID issues.
The track fades in over 0.8 s and fades out over the last 2.5 s.

    python3 lofi.py OUT.wav SECONDS [--bpm 78] [--seed 7]

Put it under a video (video stream copied, not re-encoded):

    python3 lofi.py lofi.wav 16.033
    ffmpeg -i landing.mp4 -i lofi.wav -map 0:v -map 1:a -c:v copy \
           -af volume=-3dB -c:a aac -b:a 192k -shortest landing.music.mp4

Get SECONDS from: ffprobe -v error -show_entries format=duration -of csv=p=0 VIDEO
"""
import argparse, wave
import numpy as np

ap = argparse.ArgumentParser(description="Synthesize a lo-fi background track.")
ap.add_argument("out", help="output .wav path (48 kHz, 16-bit stereo)")
ap.add_argument("seconds", type=float, help="track length; match the video duration")
ap.add_argument("--bpm", type=float, default=78)
ap.add_argument("--seed", type=int, default=7, help="changes hi-hat, snare, and vinyl noise")
args = ap.parse_args()

SR = 48000
out, dur = args.out, args.seconds
BPM = args.bpm
beat = 60 / BPM
bar = beat * 4
n = int(SR * dur)
rng = np.random.default_rng(args.seed)
mixL = np.zeros(n); mixR = np.zeros(n)

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x):
        s = (1 - a) * v + a * s; y[i] = s
    return y

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= n: return
    sig = sig[: n - i] * gain
    mixL[i:i + len(sig)] += sig * (1 - pan) ** 0.5
    mixR[i:i + len(sig)] += sig * (1 + pan) ** 0.5

def hz(m): return 440 * 2 ** ((m - 69) / 12)

def epiano(m, length):
    t = np.arange(int(SR * length)) / SR
    f = hz(m)
    mod = np.sin(2 * np.pi * f * 2 * t) * 1.2 * np.exp(-t * 6)       # bell attack
    tone = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * f * 2 * t)
    env = np.minimum(t / 0.01, 1) * np.exp(-t * 1.1)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)
    return tone * env * trem

def kick():
    t = np.arange(int(SR * 0.4)) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

def snare():
    t = np.arange(int(SR * 0.25)) / SR
    return lowpass(rng.standard_normal(len(t)), 3500) * np.exp(-t * 18) * 0.9 \
        + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.3

def hat():
    t = np.arange(int(SR * 0.06)) / SR
    x = rng.standard_normal(len(t)); x = x - lowpass(x, 7000)
    return x * np.exp(-t * 70)

def bass(m, length):
    t = np.arange(int(SR * length)) / SR
    env = np.minimum(t / 0.02, 1) * np.exp(-t * 1.5)
    return np.sin(2 * np.pi * hz(m) * t) * env

# Fmaj7 - Em7 - Dm7 - Cmaj7 (voiced around middle C)
chords = [([53, 57, 60, 64], 41), ([52, 55, 59, 62], 40), ([50, 53, 57, 60], 38), ([48, 52, 55, 59], 36)]
melody = [(0, 72), (1.5, 69), (2.5, 67), (4, 71), (5.5, 67), (8, 69), (9, 65), (10.5, 64), (12, 67), (13.5, 64)]
swing = beat * 0.08

bars = int(np.ceil(dur / bar)) + 1
for b in range(bars):
    t0 = b * bar
    notes, root = chords[b % 4]
    for k, m in enumerate(notes):                           # slight strum
        add(epiano(m, bar + 0.5), t0 + k * 0.012, 0.16, pan=-0.3 + 0.2 * k)
    add(bass(root, beat * 2), t0, 0.35); add(bass(root, beat * 1.5), t0 + beat * 2.5, 0.3)
    add(kick(), t0, 0.7); add(kick(), t0 + beat * 2.5, 0.55)
    add(snare(), t0 + beat, 0.28); add(snare(), t0 + beat * 3, 0.28)
    for e in range(8):
        add(hat(), t0 + e * beat / 2 + (swing if e % 2 else 0), 0.12 if e % 2 else 0.18, pan=0.35)
for b0 in range(0, bars, 4):                                # 4-bar melody, every other phrase
    if b0 % 8: continue
    for pos, m in melody:
        add(epiano(m, beat * 2), b0 * bar + pos * beat, 0.11, pan=0.2)

# vinyl: hiss + crackle
hiss = lowpass(rng.standard_normal(n), 5000) * 0.006
crack = np.zeros(n); idx = rng.integers(0, n, int(dur * 12)); crack[idx] = rng.uniform(-0.25, 0.25, len(idx))
mixL += hiss + crack; mixR += hiss + crack

mix = np.stack([lowpass(mixL, 6500), lowpass(mixR, 6500)], 1)      # warm, dusty top end
t = np.arange(n) / SR
fade = np.minimum(t / 0.8, 1) * np.clip((dur - t) / 2.5, 0, 1)
mix *= fade[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)                             # soft tape saturation
mix *= 0.9 / np.abs(mix).max()
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", out, dur, "s")
