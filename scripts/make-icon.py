#!/usr/bin/env python3
"""Genera build/icon.png (1024×1024) para el .app. Uso: python3 scripts/make-icon.py
electron-builder lo convierte solo a .icns al empaquetar."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

S = 1024
SCALE = 4  # se dibuja grande y se reduce, para bordes suaves
W = S * SCALE

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

# Fondo: cuadrado redondeado de 824 px (grilla de íconos de macOS) con degradé azul.
img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
inset = (S - 824) // 2 * SCALE
box = (inset, inset, W - inset, W - inset)
radius = 185 * SCALE

grad = Image.new('RGBA', (W, W))
top, bottom = (70, 155, 255), (10, 92, 210)
gd = ImageDraw.Draw(grad)
for y in range(W):
    gd.line([(0, y), (W, y)], fill=lerp(top, bottom, y / W) + (255,))
mask = Image.new('L', (W, W), 0)
ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)

# Sombra suave debajo del cuadrado
shadow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle((box[0], box[1] + 14 * SCALE, box[2], box[3] + 14 * SCALE), radius=radius, fill=(0, 0, 0, 70))
shadow = shadow.filter(ImageFilter.GaussianBlur(18 * SCALE))
img = Image.alpha_composite(img, shadow)
img.paste(grad, (0, 0), mask)

# Globo de diálogo blanco con colita
d = ImageDraw.Draw(img)
bx0, by0, bx1, by1 = 262 * SCALE, 268 * SCALE, 762 * SCALE, 662 * SCALE
d.rounded_rectangle((bx0, by0, bx1, by1), radius=110 * SCALE, fill=(255, 255, 255, 255))
d.polygon([(330 * SCALE, 620 * SCALE), (300 * SCALE, 770 * SCALE), (460 * SCALE, 655 * SCALE)], fill=(255, 255, 255, 255))

# Texto "C1" centrado en el globo
font = ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf', 250 * SCALE)
text = 'C1'
l, t, r, b = d.textbbox((0, 0), text, font=font)
tx = (bx0 + bx1) / 2 - (r - l) / 2 - l
ty = (by0 + by1) / 2 - (b - t) / 2 - t
d.text((tx, ty), text, font=font, fill=(10, 92, 210, 255))

out = img.resize((S, S), Image.LANCZOS)
os.makedirs('build', exist_ok=True)
out.save('build/icon.png')
print('build/icon.png listo')
