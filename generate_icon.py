"""
生成"花"字风格APP图标 - 替换Android mipmap各尺寸
"""
from PIL import Image, ImageDraw, ImageFont
import os

# Android mipmap尺寸映射
MIPMAP_SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

ANDROID_RES = r'C:\Users\10418\WorkBuddy\Claw\scheduler-app\android\app\src\main\res'
FRONTEND_ICONS = r'C:\Users\10418\WorkBuddy\Claw\scheduler-app\frontend\icons'

def create_flower_icon(size):
    """生成花字图标 - 渐变背景 + 花蕾 + "花"字"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角矩形背景 - 粉紫渐变
    radius = size // 5
    # 用渐变色填充
    for y in range(size):
        ratio = y / size
        r = int(236 * (1 - ratio) + 168 * ratio)  # #ec4899 -> #a855f7
        g = int(72 * (1 - ratio) + 85 * ratio)
        b = int(153 * (1 - ratio) + 247 * ratio)
        for x in range(size):
            # 圆角检查
            in_corner = False
            for cx, cy in [(radius, radius), (size-radius, radius), (radius, size-radius), (size-radius, size-radius)]:
                dx, dy = abs(x - cx), abs(y - cy)
                if dx > radius or dy > radius:
                    continue
                if (x < radius and y < radius) or (x > size-radius-1 and y < radius) or \
                   (x < radius and y > size-radius-1) or (x > size-radius-1 and y > size-radius-1):
                    if dx*dx + dy*dy > radius*radius:
                        in_corner = True
            if not in_corner:
                img.putpixel((x, y), (r, g, b, 255))

    # 画花蕾 - 五个花瓣
    center_x, center_y = size * 0.5, size * 0.42
    petal_r = size * 0.16
    petal_dist = size * 0.15

    # 花瓣颜色
    petal_colors = [
        (249, 168, 212, 230),  # 粉色
        (240, 171, 252, 230),  # 紫粉
        (253, 164, 175, 230),  # 玫红
        (249, 168, 212, 230),
        (240, 171, 252, 230),
    ]

    for i in range(5):
        angle = i * 72 - 90
        import math
        px = center_x + petal_dist * math.cos(math.radians(angle))
        py = center_y + petal_dist * math.sin(math.radians(angle))
        draw.ellipse([px - petal_r, py - petal_r, px + petal_r, py + petal_r],
                     fill=petal_colors[i % len(petal_colors)])

    # 花心
    core_r = size * 0.08
    draw.ellipse([center_x - core_r, center_y - core_r, center_x + core_r, center_y + core_r],
                 fill=(251, 191, 36, 255))  # 金黄色

    # 花茎
    stem_w = max(size * 0.025, 2)
    stem_top = center_y + core_r
    stem_bottom = size * 0.82
    draw.rectangle([center_x - stem_w, stem_top, center_x + stem_w, stem_bottom],
                   fill=(34, 197, 94, 255))

    # 叶子
    leaf_cx = center_x - size * 0.1
    leaf_cy = size * 0.68
    leaf_rx, leaf_ry = size * 0.1, size * 0.04
    draw.ellipse([leaf_cx - leaf_rx, leaf_cy - leaf_ry, leaf_cx + leaf_rx, leaf_cy + leaf_ry],
                 fill=(34, 197, 94, 255))

    leaf_cx2 = center_x + size * 0.1
    leaf_cy2 = size * 0.73
    draw.ellipse([leaf_cx2 - leaf_rx, leaf_cy2 - leaf_ry, leaf_cx2 + leaf_rx, leaf_cy2 + leaf_ry],
                 fill=(22, 163, 74, 255))

    # "花"字 - 底部居中
    font_size = int(size * 0.22)
    try:
        # 尝试使用系统中文字体
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", font_size)
    except:
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/simhei.ttf", font_size)
        except:
            font = ImageFont.load_default()

    text = "花"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) / 2
    ty = size * 0.78

    # 文字阴影
    draw.text((tx + 1, ty + 1), text, fill=(0, 0, 0, 100), font=font)
    # 白色文字
    draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)

    return img


def main():
    print("正在生成花字风格图标...")

    for folder, size in MIPMAP_SIZES.items():
        img = create_flower_icon(size)
        out_dir = os.path.join(ANDROID_RES, folder)
        os.makedirs(out_dir, exist_ok=True)

        # 替换 ic_launcher.png
        launcher_path = os.path.join(out_dir, 'ic_launcher.png')
        img.save(launcher_path, 'PNG')
        print(f"  {launcher_path} ({size}x{size})")

        # 替换 ic_launcher_round.png (圆角)
        round_path = os.path.join(out_dir, 'ic_launcher_round.png')
        # 创建圆形版本
        round_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        mask = Image.new('L', (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.ellipse([0, 0, size-1, size-1], fill=255)
        round_img.paste(img, mask=mask)
        round_img.save(round_path, 'PNG')
        print(f"  {round_path} ({size}x{size})")

        # 替换 ic_launcher_foreground.png (自适应图标前景)
        fg_path = os.path.join(out_dir, 'ic_launcher_foreground.png')
        # 自适应图标需要安全区（中间66%）
        fg_size = int(size * 1.5)
        fg_img = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        # 在中心绘制前景内容
        offset = int((fg_size - size) / 2 * 0.7)
        fg_img.paste(img.resize((int(size*0.85), int(size*0.85))), (int(fg_size*0.075), int(fg_size*0.075)))
        # 只保留花蕾+花字，去掉背景色（自适应图标背景由系统提供）
        fg_img.save(fg_path, 'PNG')
        print(f"  {fg_path}")

    # 同时生成PWA用的PNG图标
    for pwa_size in [192, 512]:
        img = create_flower_icon(pwa_size)
        pwa_path = os.path.join(FRONTEND_ICONS, f'icon-{pwa_size}.png')
        img.save(pwa_path, 'PNG')
        print(f"  {pwa_path} ({pwa_size}x{pwa_size})")

    print("\n图标生成完成！")


if __name__ == '__main__':
    main()
