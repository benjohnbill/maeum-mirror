"""Stretch a music track to a target length with inaudible loop splices.

A splice (A, B) means: at A, jump back to B and play on. It is chosen where the audio after
B is nearly identical to the audio after A (normalised correlation of the next 2.5 s), so the
jump is not heard. Several splices at different places add a few bars each, so no single
phrase repeats over and over. The track's own ending is kept for the end of the video.

Usage: python3 music_loop.py MUSIC.mp3 NEED_SECONDS [OUT.wav]
  stdout: one line of segments "s0-e0 s1-e1 ..." (seconds) to play back to back
  OUT.wav: if given, the stitched track is written there (30 ms crossfade at each splice)
  stderr: tempo, the splices and their match scores
"""
import subprocess
import sys

import numpy as np

path, need = sys.argv[1], float(sys.argv[2])
SR = 11025
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'])
x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
length = len(x) / SR

# Tempo from the onset envelope.
hop, win = 512, 2048
frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop] * np.hanning(win)
mag = np.abs(np.fft.rfft(frames, axis=1))
flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fps = SR / hop
ac = np.correlate(flux, flux, mode='full')[len(flux) - 1:]
lo, hi = int(fps * 60 / 160), int(fps * 60 / 70)
bar = 4 * (lo + int(np.argmax(ac[lo:hi]))) / fps

LOOK = int(2.5 * SR)


def best_jump(A, bars):
    """Best B near A - bars*bar (+-0.25 s) and its match score."""
    a = int(A * SR)
    ref = x[a:a + LOOK]
    ref = ref - ref.mean()
    center = A - bars * bar
    c0, c1 = int((center - 0.25) * SR), int((center + 0.25) * SR)
    if c0 < 0:
        return -1, 0
    seg = x[c0:c1 + LOOK]
    corr = np.correlate(seg, ref, mode='valid')
    energy = np.sqrt(np.convolve(seg ** 2, np.ones(LOOK), mode='valid')) * np.linalg.norm(ref) + 1e-9
    score = corr / energy
    k = int(np.argmax(score))
    return float(score[k]), (c0 + k) / SR


# Candidate splices across the body of the track (not the intro, not the outro).
cands = []
for A in np.arange(12, length - 8, 0.5):
    for bars in (4, 8):
        score, B = best_jump(A, bars)
        if score >= 0.97:
            cands.append((score, A, B))
cands.sort(reverse=True)

# Pick splices greedily by score, at least 12 s apart, until the track is long enough.
chosen = []
total = length
for score, A, B in cands:
    if total >= need:
        break
    if any(abs(A - a) < 12 or abs(B - b) < 12 for _, a, b in chosen):
        continue
    chosen.append((score, A, B))
    total += A - B
chosen.sort(key=lambda c: c[1])

# Segments: 0..A1, B1..A2, ..., Bn..end. Each A must come after the previous B.
segs, start = [], 0.0
for score, A, B in chosen:
    if A <= start:
        continue
    segs.append((start, A))
    start = B
segs.append((start, length))
print(' '.join(f'{s:.4f}-{e:.4f}' for s, e in segs))
print(f'bar {bar:.3f}s; splices ' + ', '.join(f'{A:.2f}->{B:.2f} ({s:.3f})' for s, A, B in chosen)
      + f'; music {sum(e - s for s, e in segs):.1f}s for {need:.1f}s', file=sys.stderr)

if len(sys.argv) > 3:
    out = sys.argv[3]
    n = len(segs)
    parts = [f'[0:a]asplit={n}' + ''.join(f'[s{i}]' for i in range(n))]
    for i, (a, b) in enumerate(segs):
        parts.append(f'[s{i}]atrim={a:.4f}:{b:.4f},asetpts=PTS-STARTPTS[t{i}]')
    prev = 't0'
    for i in range(1, n):
        parts.append(f'[{prev}][t{i}]acrossfade=d=0.03[x{i}]')
        prev = f'x{i}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-filter_complex', ';'.join(parts),
                    '-map', f'[{prev}]', '-ar', '48000', out], check=True)
    print(f'wrote {out}', file=sys.stderr)
