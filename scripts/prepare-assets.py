"""
Prepares the supplied photography for the site.

Source: the client ZIP (Biohack-Tech/poze). Output: src/assets/img, committed.
- Product cutouts are trimmed to the product's bounding box, so every product
  sits at the same visual scale inside the gallery stage.
- Lifestyle photos are only resized; nothing is cropped.
- next/image produces AVIF/WebP at request time; these files are the masters.

Usage: python3 scripts/prepare-assets.py /path/to/Biohack-Tech/poze
"""
import sys, os
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/biohack-src/Biohack-Tech/poze'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'img')

def save(im, rel, max_w, quality=82):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(path, 'WEBP', quality=quality, method=6)
    print(f'{rel:48s} {im.width}x{im.height} {os.path.getsize(path)//1024}K')

def trim(im, pad=0.06):
    """Crop to the visible product: alpha for cutouts, non-white for studio shots."""
    if im.mode == 'RGBA':
        box = im.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox()
    else:
        g = im.convert('L').point(lambda v: 255 if v < 244 else 0)
        box = g.getbbox()
    x0, y0, x1, y1 = box
    p = round(max(x1 - x0, y1 - y0) * pad)
    return im.crop((max(0, x0 - p), max(0, y0 - p), min(im.width, x1 + p), min(im.height, y1 + p)))

def cutout(rel_src, rel_out, max_w=1200):
    im = Image.open(os.path.join(SRC, rel_src)).convert('RGBA')
    save(trim(im), rel_out, max_w, quality=88)

def studio(rel_src, rel_out, max_w=1200):
    # White-background studio shot: kept opaque, shown with mix-blend-mode: multiply.
    im = Image.open(os.path.join(SRC, rel_src)).convert('RGB')
    save(trim(im), rel_out, max_w, quality=86)

def photo(rel_src, rel_out, max_w=1600):
    im = Image.open(os.path.join(SRC, rel_src)).convert('RGB')
    save(im, rel_out, max_w)

# ---------- Ochelari Biohack: 4 variants ----------
G = '05_Ochelari-Biohack/glasses_'
cutout('01_Acasa/glasses_cat-eye-black_01.webp', 'glasses/cat-eye-negru-1.webp')
for i in range(2, 6):
    cutout(f'{G}cat-eye-black_0{i}.webp', f'glasses/cat-eye-negru-{i}.webp')
for i in range(1, 5):
    src = f'{G}cay-eye-pink_0{i}.webp'
    if i == 2:
        # This one ships with an opaque white panel behind the frame.
        im = Image.open(os.path.join(SRC, src)).convert('RGBA')
        rgb = im.convert('RGB')
        ImageDraw.floodfill(rgb, (100, 5), (255, 0, 255), thresh=18)
        px, mask = rgb.load(), im.copy()
        mp = mask.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y] == (255, 0, 255):
                    mp[x, y] = (0, 0, 0, 0)
        save(trim(mask), 'glasses/cat-eye-bej-2.webp', 1200, quality=88)
    else:
        cutout(src, f'glasses/cat-eye-bej-{i}.webp')
for i in range(1, 6):
    cutout(f'{G}black-unisex-patrat_0{i}.webp', f'glasses/patrat-negru-{i}.webp')
for i in range(1, 5):
    cutout(f'{G}maro-unisex-patrat_0{i}.webp', f'glasses/patrat-maro-{i}.webp')
photo('01_Acasa/glasses_hero-glasses.png', 'glasses/lifestyle-terasa.webp')
for n in ['audience-birou', 'audience-seara', 'audience-stil', 'result-focus', 'result-seara', 'result-stil']:
    photo(f'{G}{n}.webp', f'glasses/{n}.webp', 1200)

# ---------- Balance Wave ----------
B = '06_Balance-Wave/neck-joy_'
cutout('01_Acasa/neck-joy_04.png', 'balance-wave/cutie.webp')
cutout(f'{B}01.png', 'balance-wave/dispozitiv-activ.webp')
cutout(f'{B}02.png', 'balance-wave/dispozitiv.webp')
photo('01_Acasa/neck-joy_hero-nervul-vag.png', 'balance-wave/lifestyle-canapea.webp')
photo('01_Acasa/neck-joy_neck-joy-woman.webp', 'balance-wave/lifestyle-birou.webp')
for n in ['audience-stres', 'audience-birou', 'audience-somn', 'pillar-nerv-vag', 'pillar-calm',
          'result-calm', 'result-somn', 'result-echilibru']:
    photo(f'{B}{n}.{"webp" if n.startswith("pillar") else "png"}', f'balance-wave/{n}.webp', 1200)

# ---------- BrainLink Pro ----------
L = '07_BrainLink-Pro/brainlink-pro_'
studio(f'{L}brainlink-product-3.webp', 'brainlink/casca.webp')
studio(f'{L}brainlink-product-2.webp', 'brainlink/casca-lateral.webp')
studio(f'{L}brainlink-product-1.webp', 'brainlink/casca-geanta.webp')
photo(f'{L}pillar-bio-sensing.webp', 'brainlink/casca-studio.webp', 1400)
photo(f'{L}product-description-brainlink-pro.webp', 'brainlink/componente.webp', 1672)
photo('01_Acasa/brainlink-pro_brainlink-pro-woman.webp', 'brainlink/lifestyle-relaxare.webp')
photo('01_Acasa/brainlink-pro_brainlink-man.webp', 'brainlink/lifestyle-barbat.webp')
# The source site swapped these two alt texts; filenames here describe what is in the photo.
photo(f'{L}audience-daily-training.webp', 'brainlink/audience-meditatie.webp', 1200)
photo(f'{L}audience-meditation-calm.webp', 'brainlink/audience-lucru.webp', 1200)
for n in ['pillar-emolight', 'pillar-games', 'result-focus', 'result-meditation', 'result-energy']:
    photo(f'{L}{n}.webp', f'brainlink/{n}.webp', 1200)
