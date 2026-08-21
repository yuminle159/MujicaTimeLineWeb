import os
from PIL import Image

def batch_convert_to_webp(folder_path, quality_setting=85):
    # 遍历文件夹下的所有文件
    for filename in os.listdir(folder_path):
        # 筛选出 jpg 和 png 图片
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            file_path = os.path.join(folder_path, filename)
            name_without_ext = os.path.splitext(filename)[0]
            webp_path = os.path.join(folder_path, f"{name_without_ext}.webp")
            
            try:
                # 打开图片
                with Image.open(file_path) as img:
                    # 统一转换为 RGB 或 RGBA（保留 PNG 的透明背景）
                    if img.mode not in ('RGB', 'RGBA'):
                        img = img.convert('RGBA')
                        
                    # 保存为 webp 格式
                    img.save(webp_path, 'webp', quality=quality_setting)
                    print(f"✅ 成功: {filename} -> {name_without_ext}.webp")
            except Exception as e:
                print(f"❌ 失败 {filename}: {e}")

# 填入你存放图片的实际文件夹名称，如果是当前目录就写 '.'
image_folder = '.' 
print("开始转换图片...")
batch_convert_to_webp(image_folder)
print("全部转换完成！")