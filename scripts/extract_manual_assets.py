import fitz
import os

pdf_path = r'C:\Users\pc2\Desktop\manuale portale bollette.pdf'
out_dir = r'C:\Users\pc2\Desktop\ACQDASH\acqdash\presentations\manual_assets'
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
print(f'Total pages: {len(doc)}')

img_count = 0
for i, page in enumerate(doc):
    image_list = page.get_images(full=True)
    print(f'Page {i+1} has {len(image_list)} images')
    for img_idx, img in enumerate(image_list):
        xref = img[0]
        base_image = doc.extract_image(xref)
        image_bytes = base_image['image']
        image_ext = base_image['ext']
        w = base_image.get('width', 0)
        h = base_image.get('height', 0)
        image_filename = f'page_{i+1}_img_{img_idx+1}_{xref}.{image_ext}'
        image_filepath = os.path.join(out_dir, image_filename)
        with open(image_filepath, 'wb') as f:
            f.write(image_bytes)
        img_count += 1
        print(f'  Extracted: {image_filename} ({w}x{h})')

print(f'Total extracted images: {img_count}')
