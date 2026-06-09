from PIL import Image, ImageDraw

SIZE = 81
OUTPUT_DIR = "miniprogram/images/"

# Define icons: (filename, shape_type)
# inventory = box, outbound = arrow-right, inbound = arrow-left, settings = gear
icons = {
    "tab-inventory": "box",
    "tab-inventory-active": "box",
    "tab-outbound": "arrow_right",
    "tab-outbound-active": "arrow_right",
    "tab-inbound": "arrow_left",
    "tab-inbound-active": "arrow_left",
    "tab-settings": "gear",
    "tab-settings-active": "gear",
}

def draw_box(draw, color):
    """Draw a simple box/inventory icon"""
    # Box body
    draw.rectangle([20, 25, 61, 56], outline=color, width=3)
    # Box lid
    draw.rectangle([15, 20, 66, 30], outline=color, width=3)
    draw.rectangle([15, 20, 66, 30], fill=color)
    # Horizontal line on box
    draw.line([20, 40, 61, 40], fill=color, width=2)

def draw_arrow_right(draw, color):
    """Draw an arrow pointing right (outbound)"""
    # Box
    draw.rectangle([18, 22, 50, 55], outline=color, width=3)
    # Arrow
    draw.polygon([50, 15, 66, 38, 50, 61], fill=color)
    # Arrow shaft
    draw.rectangle([35, 35, 55, 42], fill="white")

def draw_arrow_left(draw, color):
    """Draw an arrow pointing left (inbound)"""
    # Box
    draw.rectangle([31, 22, 63, 55], outline=color, width=3)
    # Arrow
    draw.polygon([31, 15, 15, 38, 31, 61], fill=color)
    # Arrow shaft
    draw.rectangle([26, 35, 46, 42], fill="white")

def draw_gear(draw, color):
    """Draw a simple gear/settings icon"""
    cx, cy = 40, 40
    r_outer = 18
    r_inner = 10
    # Draw circle
    draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], outline=color, width=3)
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], outline=color, width=2)
    # Draw 4 gear teeth
    import math
    for angle in [0, 45, 90, 135, 180, 225, 270, 315]:
        rad = math.radians(angle)
        x1 = cx + (r_outer - 1) * math.cos(rad)
        y1 = cy + (r_outer - 1) * math.sin(rad)
        x2 = cx + (r_outer + 6) * math.cos(rad)
        y2 = cy + (r_outer + 6) * math.sin(rad)
        draw.line([x1, y1, x2, y2], fill=color, width=4)

draw_funcs = {
    "box": draw_box,
    "arrow_right": draw_arrow_right,
    "arrow_left": draw_arrow_left,
    "gear": draw_gear,
}

# Colors: inactive = #999999, active = #1890ff
inactive_color = (153, 153, 153)  # #999999
active_color = (24, 144, 255)     # #1890ff

for filename, shape in icons.items():
    is_active = "active" in filename
    color = active_color if is_active else inactive_color

    img = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw_funcs[shape](draw, color)

    filepath = OUTPUT_DIR + filename + ".png"
    img.save(filepath, "PNG")
    print(f"Generated {filepath} ({SIZE}x{SIZE}, {'active' if is_active else 'inactive'})")

print("\nAll tab icons generated successfully!")
