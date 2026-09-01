import os, json, subprocess, urllib.parse, urllib.request

ROOT = os.path.abspath('.')
OUT_DIR = os.path.join(ROOT, 'out')
with open(os.path.join(OUT_DIR, 'imgs.json'), 'r', encoding='utf-8') as f:
    imgs = json.load(f)

print('Loaded images:', len(imgs))
