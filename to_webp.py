import os
from PIL import Image

def optimize_and_convert_to_webp(src_dir, max_width=1920, quality=75):
    """
    遍历目录，将所有图片转为限制分辨率与画质的 WebP（安全覆盖版）
    :param src_dir: 图片文件夹路径
    :param max_width: 允许的最大宽度（像素），超出自动等比缩小
    :param quality: WebP 保存质量（推荐 70-80）
    """
    supported_formats = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp')

    for root, _, files in os.walk(src_dir):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext not in supported_formats:
                continue
                
            file_path = os.path.join(root, file)
            output_path = os.path.splitext(file_path)[0] + ".webp"
            temp_path = output_path + ".tmp"  # 临时文件，用于安全保存
            
            orig_size_kb = os.path.getsize(file_path) / 1024
            
            try:
                # 开启 with 语句读取图片，离开该缩进区块时，Python 会自动释放图片文件占用
                with Image.open(file_path) as img:
                    # 转换色彩模式
                    if img.mode in ("RGBA", "P") and ext not in ('.png', '.webp'):
                        img = img.convert("RGBA")
                    elif img.mode != "RGB" and img.mode != "RGBA":
                        img = img.convert("RGB")

                    # 1. 检查并等比例缩小分辨率
                    orig_w, orig_h = img.size
                    if orig_w > max_width:
                        new_h = int(orig_h * (max_width / orig_w))
                        img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)
                        print(f"[缩放] {file}: {orig_w}x{orig_h} -> {max_width}x{new_h}")

                    # 2. 保存为临时文件
                    img.save(temp_path, "WEBP", quality=quality, method=6)
                
                # --- 注意：此时已退出 with 区块，原文件的占用已经被彻底释放 ---
                
                # 3. 确认临时文件大小
                new_size_kb = os.path.getsize(temp_path) / 1024
                
                # 4. 安全替换原文件（os.replace 会直接覆盖目标路径的旧文件）
                os.replace(temp_path, output_path)
                
                print(f"[成功] {file} ({orig_size_kb:.1f}KB) -> ({new_size_kb:.1f}KB)")
                
                # 如果你想顺手把原来的 .jpg 或 .png 删掉，可以取消下面两行的注释
                # if ext != '.webp' and file_path != output_path:
                #     os.remove(file_path)
                
            except Exception as e:
                print(f"[报错/跳过] 无法处理文件 {file_path}: {e}")
                # 如果运行出错且残留了临时文件，进行清理
                if os.path.exists(temp_path):
                    os.remove(temp_path)

if __name__ == "__main__":
    # 这里已经帮你填好了你本地的路径
    target_folder = r"F:\mujicatimelineweb\images"
    
    print("开始执行图片瘦身与格式优化...")
    optimize_and_convert_to_webp(target_folder, max_width=1920, quality=75)
    print("所有操作执行完毕！")
