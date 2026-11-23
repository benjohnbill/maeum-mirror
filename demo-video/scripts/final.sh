#!/usr/bin/env bash
# Join the landing take, the phone take, and the end card into herz-demo-final.mp4, with lo-fi music under all of it.
# Inputs in herz-demo: landing-B.mp4, phone.mp4 (+ phone.marks.json for captions), end-card.png, tranquil-pulse.mp3 (Pixabay, 'Tranquil Pulse' by Pumpupthemind, Pixabay Content License).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
cd /mnt/c/Users/benjohnbill/AppData/Local/Temp/herz-demo
# Burn the four phone captions first (phone.mp4 -> phone-cap.mp4).
python3 "$HERE/captions.py"
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
L=$(dur landing-B.mp4); P=$(dur phone-cap.mp4); X1=0.4; X2=0.7; C=5
calc() { python3 -c "print(round($1, 3))"; }
T=$(calc "$L+$P+$C-$X1-$X2")
# The track (76.6 s) is shorter than the video: stretch it with inaudible 4-bar loop splices.
python3 "$HERE/music_loop.py" tranquil-pulse.mp3 "$T" music-fit.wav >/dev/null
ffmpeg -loglevel error -y -i landing-B.mp4 -i phone-cap.mp4 -loop 1 -framerate 60 -t $C -i end-card.png -i music-fit.wav -filter_complex "
[0:v]scale=-2:1080,pad=1752:1080:(ow-iw)/2:0:color=#e8d6c9,setsar=1,fps=60,format=yuv420p[a];
[1:v]scale=-2:1080,pad=1752:1080:(ow-iw)/2:0:color=black,setsar=1,fps=60,format=yuv420p[b];
[2:v]setsar=1,fps=60,format=yuv420p[c];
[a][b]xfade=transition=fade:duration=$X1:offset=$(calc "$L-$X1")[ab];
[ab][c]xfade=transition=fade:duration=$X2:offset=$(calc "$L+$P-$X1-$X2")[v];
[3:a]atrim=0:$T,afade=t=in:d=1,afade=t=out:st=$(calc "$T-3"):d=3[m]" \
  -map "[v]" -map "[m]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart herz-demo-final.mp4
echo "herz-demo-final.mp4: ${T}s"
