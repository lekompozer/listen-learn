from PIL import Image, ImageDraw
import numpy as np

W, H = 1024, 1024

# ── Step 1: Green gradient background (emerald-500 → teal-600) ──────────────
# matches download page accentFrom/accentTo for listen-learn
bg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(bg)
for y in range(H):
    t = y / (H - 1)
    r_c = int(0x10 + (0x0D - 0x10) * t)  # 16 → 13
    g_c = int(0xB9 + (0x94 - 0xB9) * t)  # 185 → 148
    b_c = int(0x81 + (0x88 - 0x81) * t)  # 129 → 136
    draw.line([(0, y), (W, y)], fill=(r_c, g_c, b_c, 255))

# Rounded-rect mask
mask = Image.new("L", (W, H), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, W - 1, H - 1], radius=210, fill=255)
bg.putalpha(mask)

# ── Step 2: Load fox PNG, multiply-blend onto green bg ──────────────────────
# For a black-on-white illustration: black pixels stay black, white pixels
# become the background (green). This is the correct blend for flat logos.
src = Image.open(
    "/Users/user/Code/listen-learn/src-tauri/icons/icon-FoxLearn-Eng.png"
).convert("RGB")
fox_size = int(W * 0.82)
src = src.resize((fox_size, fox_size), Image.LANCZOS)

fox_arr = np.array(src).astype(np.float32)  # shape (fox_size, fox_size, 3), 0-255

# Crop the matching region of bg for multiply
x_off = (W - fox_size) // 2
y_off = (H - fox_size) // 2 + 10
bg_rgb = bg.convert("RGB")
bg_arr = np.array(bg_rgb).astype(np.float32)
bg_crop = bg_arr[
    y_off : y_off + fox_size, x_off : x_off + fox_size
]  # (fox_size, fox_size, 3)

# Multiply: blended = fox/255 * bg_crop
blended = (fox_arr / 255.0) * bg_crop
blended_img = Image.fromarray(blended.astype(np.uint8), "RGB")

# Rounded-rect mask
mask = Image.new("L", (W, H), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, W - 1, H - 1], radius=210, fill=255)
bg.putalpha(mask)

# ── Step 3: Composite — paste multiplied fox onto green bg ──────────────────
offset = (x_off, y_off)
result = bg.copy()
result.paste(blended_img, offset)

# Save all required Tauri icon sizes
result.save("/Users/user/Code/listen-learn/src-tauri/icons/icon.png")
print("icon.png 1024x1024 OK")

result.resize((32, 32), Image.LANCZOS).save(
    "/Users/user/Code/listen-learn/src-tauri/icons/32x32.png"
)
result.resize((64, 64), Image.LANCZOS).save(
    "/Users/user/Code/listen-learn/src-tauri/icons/64x64.png"
)
result.resize((128, 128), Image.LANCZOS).save(
    "/Users/user/Code/listen-learn/src-tauri/icons/128x128.png"
)
result.resize((256, 256), Image.LANCZOS).save(
    "/Users/user/Code/listen-learn/src-tauri/icons/128x128@2x.png"
)

for size in [30, 44, 71, 89, 107, 142, 150, 284, 310]:
    result.resize((size, size), Image.LANCZOS).save(
        f"/Users/user/Code/listen-learn/src-tauri/icons/Square{size}x{size}Logo.png"
    )
result.resize((50, 50), Image.LANCZOS).save(
    "/Users/user/Code/listen-learn/src-tauri/icons/StoreLogo.png"
)

# Also save a 512x512 for use on the download page
result.resize((512, 512), Image.LANCZOS).save(
    "/Users/user/Code/listen-learn/src-tauri/icons/icon-512.png"
)
print("All icons saved OK")
