import os
import math
from PIL import Image, ImageDraw

def create_icon(size):
    # Render at 4x for smooth antialiasing
    scale = 4
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = int(canvas_size * 0.08)
    radius = int(canvas_size * 0.28)

    # Background squircle
    bg_color = (15, 23, 42, 255)       # Deep slate blue #0f172a
    border_color = (99, 102, 241, 180)  # Indigo glow #6366f1
    
    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [margin, margin, canvas_size - margin, canvas_size - margin],
        radius=radius,
        fill=bg_color,
        outline=border_color,
        width=max(1, int(canvas_size * 0.035))
    )

    cx = canvas_size / 2.0
    cy = canvas_size / 2.0

    # Eye Comfort & Crescent Moon motif
    # Draw crescent moon (amber warm glow) on the left/top
    moon_radius = canvas_size * 0.26
    moon_cx = cx - canvas_size * 0.04
    moon_cy = cy - canvas_size * 0.04

    # Warm amber crescent
    amber_glow = (245, 158, 11, 255) # #f59e0b
    draw.ellipse(
        [moon_cx - moon_radius, moon_cy - moon_radius, moon_cx + moon_radius, moon_cy + moon_radius],
        fill=amber_glow
    )
    # Mask out the inner circle of crescent
    cutout_radius = canvas_size * 0.22
    cutout_cx = moon_cx + canvas_size * 0.10
    cutout_cy = moon_cy - canvas_size * 0.05
    draw.ellipse(
        [cutout_cx - cutout_radius, cutout_cy - cutout_radius, cutout_cx + cutout_radius, cutout_cy + cutout_radius],
        fill=bg_color
    )

    # Draw protective Eye outline with soothing cyan/indigo iris
    # Stylized almond eye shape
    eye_w = canvas_size * 0.36
    eye_h = canvas_size * 0.18
    eye_cy = cy + canvas_size * 0.10
    eye_cx = cx + canvas_size * 0.06

    iris_radius = canvas_size * 0.09
    iris_color = (129, 140, 248, 255) # #818cf8 Soft Indigo
    pupil_color = (255, 255, 255, 255) # Sparkle / pupil

    # Iris circle
    draw.ellipse(
        [eye_cx - iris_radius, eye_cy - iris_radius, eye_cx + iris_radius, eye_cy + iris_radius],
        fill=iris_color
    )
    # Pupil spark
    pupil_r = iris_radius * 0.42
    draw.ellipse(
        [eye_cx - pupil_r, eye_cy - pupil_r, eye_cx + pupil_r, eye_cy + pupil_r],
        fill=pupil_color
    )

    # Downsample with high-quality Lanczos resampling
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), "icons")
    os.makedirs(icons_dir, exist_ok=True)

    sizes = [16, 32, 48, 128]
    for s in sizes:
        icon_img = create_icon(s)
        path = os.path.join(icons_dir, f"icon-{s}.png")
        icon_img.save(path, "PNG")
        print(f"Generated {path} ({s}x{s})")

if __name__ == "__main__":
    main()
