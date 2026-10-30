from pathlib import Path
import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    (ROOT/'storage'/'private'/'originals'/'2025-26_운영대장_총편.pdf', ROOT/'public'/'assets'/'docs'/'summary'),
    (ROOT/'storage'/'private'/'originals'/'2025-26_운영대장_본책1.pdf', ROOT/'public'/'assets'/'docs'/'book1'),
    (ROOT/'storage'/'private'/'originals'/'2025-26_운영대장_본책2.pdf', ROOT/'public'/'assets'/'docs'/'book2'),
]

for pdf_path, out_dir in SOURCES:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    print(f'{pdf_path.name}: {len(doc)} pages')
    for i, page in enumerate(doc, start=1):
        out = out_dir / f'p{i:03d}.webp'
        if out.exists():
            continue
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        img = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
        img.thumbnail((1100, 1700))
        img.save(out, 'WEBP', quality=72, method=6)
    doc.close()
print('done')
