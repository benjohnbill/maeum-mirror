"""Burn the four phone-scene captions onto phone.mp4 -> phone-cap.mp4.

Usage: python3 captions.py [DIR]   (DIR defaults to $DEMO_DIR, else C:/Users/$USER/Videos/herz-demo)

Scene borders come from phone.marks.json (recording time) and are mapped to video time
through the project's trims and speed regions:
  01 start~opening  02 opening~talk  03 talk~report  04 report~end
Each caption sits in the empty space left of the phone, fades in over 0.3 s at its
border, and stays until the next one starts.
"""
import json
import os
import subprocess
import sys
import tempfile

DIR = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('DEMO_DIR', f"/mnt/c/Users/{os.environ.get('USER', '')}/Videos/herz-demo")
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'   # Noto Sans CJK (Hangul is the same in every face)
CAPTIONS = [
    ('01', ['사용자의 건강 데이터를 연동합니다']),
    ('02', ['가벼운 퀴즈로 사용자와 라포를 쌓습니다']),
    ('03', ['건강 데이터의 특이사항을 물어보고,', '심리를 분석합니다']),
    ('04', ['리포트와 검사 결과를 드립니다']),
]
BORDERS = ['start', 'opening', 'talk', 'report']

marks = json.load(open(os.path.join(DIR, 'phone.marks.json'), encoding='utf-8'))
trims = sorted((t['startMs'], t['endMs']) for t in marks['trims'])
speeds = [(s['startMs'], s['endMs'], s['speed']) for s in marks.get('speeds', [])]


def video_time(ms):
    """Recording ms -> seconds in the exported video."""
    out = ms
    for a, b in trims:
        out -= max(0, min(ms, b) - a) if ms > a else 0
    for a, b, sp in speeds:
        out -= (max(0, min(ms, b) - a) if ms > a else 0) * (1 - 1 / sp)
    return out / 1000


at = {m['name']: m['ms'] for m in marks['marks']}
src = os.path.join(DIR, 'phone.mp4')
duration = float(subprocess.check_output(
    ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).decode().strip())
starts = [video_time(at[name]) for name in BORDERS]
ends = starts[1:] + [duration]

# Layout at 1080p: left column, vertically centred. Quiet colours so the app stays the focus.
X, NUM_SIZE, LINE_SIZE, GAP = 96, 20, 27, 14
NUM_COLOR, LINE_COLOR = '0xb8aea5', '0xe6ded6'
tmp = tempfile.mkdtemp(prefix='cap-')
filters = []
for i, ((num, lines), a, b) in enumerate(zip(CAPTIONS, starts, ends)):
    alpha = f"if(lt(t\\,{a:.3f}+0.3)\\,(t-{a:.3f})/0.3\\,1)"
    enable = f"between(t\\,{a:.3f}\\,{b:.3f})"
    block = NUM_SIZE + GAP + len(lines) * (LINE_SIZE + 10)
    y0 = 540 - block // 2
    parts = [(num, NUM_SIZE, NUM_COLOR, y0)]
    for k, line in enumerate(lines):
        parts.append((line, LINE_SIZE, LINE_COLOR, y0 + NUM_SIZE + GAP + k * (LINE_SIZE + 10)))
    for j, (text, size, color, y) in enumerate(parts):
        path = os.path.join(tmp, f'{i}-{j}.txt')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        filters.append(
            f"drawtext=fontfile={FONT}:textfile={path}:x={X}:y={y}:fontsize={size}:fontcolor={color}"
            f":alpha='{alpha}':enable='{enable}'")

out = os.path.join(DIR, 'phone-cap.mp4')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-vf', ','.join(filters),
                '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', out], check=True)
print('captions at', ', '.join(f'{s:.1f}s' for s in starts), '->', out)
