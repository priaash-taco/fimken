"""Inspect generated PNGs and create a compact material preview. No API calls."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/imagegen'
sources = [('orange-gi', 'Orange woven gi'), ('navy-cotton', 'Navy cotton'),
           ('warm-skin', 'Painted skin base'), ('ink-hair', 'Ink-blue hair')]
sheet = Image.new('RGB', (1280, 1380), '#12121b')
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 24)
except OSError:
    font = ImageFont.load_default()
report = {'generation': 'OpenAI Image API via bundled imagegen CLI',
          'model': 'gpt-image-2', 'quality': 'high', 'native8K': False,
          'images': []}
for index, (slug, label) in enumerate(sources):
    path = OUT / (slug + '-source.png')
    with Image.open(path) as image:
        image.load()
        if image.size != (2048, 2048):
            raise ValueError(f'Unexpected source dimensions: {slug}: {image.size}')
        x, y = (index % 2) * 640, (index // 2) * 690
        sheet.paste(image.convert('RGB').resize((616, 616), Image.Resampling.LANCZOS), (x+12,y+12))
        draw.text((x+18,y+643), label + ' / 2048 px', fill='#eeeeff', font=font)
        report['images'].append({'file':path.name, 'size':list(image.size),
            'mode':image.mode,'bytes':path.stat().st_size,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'prompt':str(ROOT / 'art/textures' / (slug+'.txt'))})
sheet.save(OUT / 'material-preview.jpg', quality=94)
(OUT / 'texture-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
