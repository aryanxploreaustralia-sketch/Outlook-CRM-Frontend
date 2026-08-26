"""
Generates the PWA icon set from the official Xplore Australia logo.

NOT part of the build. The icons it writes are committed, and this exists so
that if the logo is ever replaced the icons can be regenerated the same way
rather than hand-cropped differently each time.

    python scripts/generate-pwa-icons.py

Requires Pillow, which is deliberately not a project dependency — this is a
one-off authoring tool, not something `npm run build` should need.

## What it does, and does not do

The source mark is 841x704 with transparent padding. Every output preserves
that aspect ratio exactly: the logo is trimmed to its own alpha bounds, scaled
by a single factor, and centred. It is never stretched to fill a square, and it
is never redrawn.

The square canvas is white rather than transparent. The mark is a warm red, and
a transparent icon disappears into a dark Windows taskbar; white is how the logo
is presented everywhere else in the product.

`maskable` gets a smaller logo. Android and Chrome crop a maskable icon to
whatever shape the platform uses, and only the central circle of 80% diameter is
guaranteed to survive — whose inscribed square is about 57% of the width. 60%
keeps the whole mark inside it with a margin.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public' / 'xplore-logo-mark.png'
BACKGROUND = (255, 255, 255, 255)

# Fraction of the canvas the logo's longest side occupies.
FILL_ANY = 0.82
FILL_MASKABLE = 0.60


def render(size: int, fill: float, out: Path) -> None:
    source = Image.open(SOURCE).convert('RGBA')

    # Trim the asset's own transparent padding, so `fill` means the same thing
    # regardless of how much whitespace the exported file happens to carry.
    bbox = source.getchannel('A').getbbox()
    logo = source.crop(bbox)

    # One scale factor for both axes. This is what keeps the mark undistorted.
    scale = (size * fill) / max(logo.width, logo.height)
    target = (max(1, round(logo.width * scale)), max(1, round(logo.height * scale)))
    logo = logo.resize(target, Image.LANCZOS)

    canvas = Image.new('RGBA', (size, size), BACKGROUND)
    canvas.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
    canvas.save(out, 'PNG', optimize=True)

    print(f'  {out.name:<30} {size}x{size}  logo {target[0]}x{target[1]}  {out.stat().st_size // 1024}KB')


def main() -> None:
    public = ROOT / 'public'
    print(f'source: {SOURCE.name}')

    render(192, FILL_ANY, public / 'pwa-icon-192.png')
    render(512, FILL_ANY, public / 'pwa-icon-512.png')
    render(512, FILL_MASKABLE, public / 'pwa-icon-maskable-512.png')

    # The source aspect ratio, restated, so a regression is obvious in the log.
    source = Image.open(SOURCE)
    print(f'source aspect {source.width}:{source.height} preserved in every output')


if __name__ == '__main__':
    main()
