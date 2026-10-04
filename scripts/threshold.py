from pathlib import Path
from PIL import Image
import tomllib

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "garden.toml"
STATIC = ROOT / "static"
OUT = STATIC / "garden" / "thresholded"
BLUE = (39, 129, 196, 255)
MAX_WIDTH = 440


def threshold_image(source: Path, destination: Path, threshold: float) -> None:
    image = Image.open(source).convert("RGBA")
    if image.width > MAX_WIDTH:
        height = round(image.height * MAX_WIDTH / image.width)
        image = image.resize((MAX_WIDTH, height), Image.Resampling.LANCZOS)

    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = pixels[x, y]
            brightness = (r + g + b) / 3
            pixels[x, y] = BLUE if brightness < threshold else (0, 0, 0, 0)

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "PNG", optimize=True)


def main() -> None:
    garden = tomllib.loads(DATA.read_text(encoding="utf-8"))
    for item in garden["items"]:
        source = STATIC / item["image"]
        destination = OUT / f"{source.stem}.png"
        threshold_image(source, destination, float(item["threshold"]))
        print(f"{source.name} -> {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
