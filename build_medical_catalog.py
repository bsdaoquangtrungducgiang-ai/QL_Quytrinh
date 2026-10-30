#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script phân loại khoa học và lập danh mục toàn bộ Văn Bản Y Tế
Khoa Vi Sinh - BVĐK Đức Giang
"""

import os, hashlib, json, re, unicodedata

BASE_DIR = os.path.join(os.path.dirname(__file__), 'Tài Liệu', 'VĂN BẢN Y TẾ')
SUPABASE_URL = "https://wbzjkwudiaeisujoimfi.supabase.co"
BUCKET_NAME = "tai-lieu"

def nfc(s):
    return unicodedata.normalize('NFC', str(s)).strip()

def remove_vn_tones(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return s.replace('đ', 'd').replace('Đ', 'D').lower()

def to_safe_key(text):
    text = remove_vn_tones(text)
    text = re.sub(r'[^a-zA-Z0-9._/-]', '_', text)
    text = re.sub(r'_+', '_', text)
    return text.strip('_')

def get_hash(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def format_size(sz):
    if sz >= 1024 * 1024:
        return f'{sz / (1024*1024):.1f} MB'
    return f'{sz / 1024:.0f} KB'

def get_file_format_info(filename):
    ext = os.path.splitext(filename)[1].lower()
    if ext in ['.doc', '.docx']:
        return {'type': 'word', 'label': 'Word', 'icon': '📝', 'cssClass': 'format-word'}
    if ext in ['.xls', '.xlsx', '.csv']:
        return {'type': 'excel', 'label': 'Excel', 'icon': '📊', 'cssClass': 'format-excel'}
    if ext in ['.png', '.jpg', '.jpeg', '.webp', '.bmp']:
        return {'type': 'image', 'label': 'Ảnh', 'icon': '🖼️', 'cssClass': 'format-image'}
    if ext == '.zip':
        return {'type': 'zip', 'label': 'ZIP', 'icon': '📦', 'cssClass': 'format-zip'}
    return {'type': 'pdf', 'label': 'PDF', 'icon': '📄', 'cssClass': 'format-pdf'}

def clean_doc_title(filename, folder_name):
    # Remove file extension
    name, ext = os.path.splitext(filename)
    if name.lower().endswith('.pdf'): # e.g. file.pdf.docx
        name = os.path.splitext(name)[0]
    
    name = name.replace('_', ' ').replace('-', ' ')
    name = re.sub(r'\s+', ' ', name).strip()
    
    # Capitalize standard Vietnamese words if title is lowercase
    return nfc(name)

def extract_year(text, default_year=2024):
    m = re.findall(r'\b(20[12][0-9])\b', text)
    if m:
        years = [int(y) for y in m]
        # Return plausible year (2010 to 2026)
        valid = [y for y in years if 2010 <= y <= 2026]
        if valid:
            return max(valid)
    return default_year

def extract_code(text):
    t = text.replace('_', ' ')
    if 'iso' in t.lower() and '15189' in t.lower():
        return 'ISO 15189:2022'
    
    # Match patterns like QĐ 2633, 2633/QĐ-BYT, TT 32/2024, NĐ 96/2023, NQ 30/2023
    patterns = [
        r'\b((?:QĐ|QD)[\s\.\-_]*[0-9]+(?:/[A-Z0-9\-_]+)*)\b',
        r'\b([0-9]+[\s\.\-_]*(?:QĐ|QD|QD-BYT|QĐ-BYT))\b',
        r'\b((?:TT|THÔNG TƯ)[\s\.\-_]*[0-9]+(?:/[0-9]+)?(?:/[A-Z0-9\-_]+)*)\b',
        r'\b((?:NĐ|ND|NGHỊ ĐỊNH)[\s\.\-_]*[0-9]+(?:/[0-9]+)?(?:/[A-Z0-9\-_]+)*)\b',
        r'\b((?:NQ|NGHỊ QUYẾT)[\s\.\-_]*[0-9]+(?:/[0-9]+)?(?:/[A-Z0-9\-_]+)*)\b',
        r'\b((?:CĐ|CD|CÔNG ĐIỆN)[\s\.\-_]*[0-9]+(?:/[A-Z0-9\-_]+)*)\b',
        r'\b((?:LUẬT|LUAT)[\s\.\-_]*[0-9]+(?:/[0-9]+)?(?:/[A-Z0-9\-_]+)*)\b',
    ]
    for pat in patterns:
        m = re.search(pat, t, re.IGNORECASE)
        if m:
            c = m.group(1).strip()
            c = re.sub(r'\s+', ' ', c)
            return c.upper()
    return ''

def extract_issuer(rel_path, filename):
    t = (rel_path + ' ' + filename).lower()
    if 'sở y tế' in t or 'so y te' in t or 'syt' in t:
        return 'Sở Y tế Hà Nội'
    if 'đức giang' in t or 'duc giang' in t or 'bệnh viện' in t or 'benh vien' in t or '13.2.' in t:
        return 'BVĐK Đức Giang'
    if 'iso' in t or 'aosc' in t:
        return 'Tổ chức ISO / AOSC'
    if 'chính phủ' in t or 'chinh phu' in t or 'nđ-cp' in t or 'nd-cp' in t or 'nq-cp' in t or 'nq 30' in t:
        return 'Chính phủ'
    if 'quốc hội' in t or 'luật' in t or 'luat' in t or ':qh' in t:
        return 'Quốc hội'
    if 'bkhdt' in t:
        return 'Bộ Kế hoạch & Đầu tư'
    return 'Bộ Y tế'

def classify(item):
    folder = nfc(item['folder']).lower()
    rel = nfc(item['rel_dir']).lower()
    fn = nfc(item['filename']).lower()

    # 1. Covid-19 & Phòng chống dịch
    if 'covid' in rel or 'covid' in fn or '13.7' in folder or 'phòng và kiểm soát lây nhiễm' in fn:
        return 'Phong_Chong_Dich_Covid', 'Phòng Chống Dịch & Covid-19', 'Phong_Chong_Dich_Covid'
    
    # 2. Phác đồ điều trị bệnh (Bộ Y tế)
    if 'điều trị' in folder or 'điều trị' in rel or 'dieu tri' in rel or 'phác đồ' in fn or 'chan doan dieu tri' in fn:
        return 'Phac_Do_Dieu_Tri', 'Phác Đồ Chẩn Đoán & Điều Trị Bệnh', 'Phac_Do_Dieu_Tri'
        
    # 3. Quản lý chất lượng PXN & ISO 15189
    if 'đánh giá' in folder or '2429' in fn or 'iso' in fn or '5530' in fn or 'tiêu chí' in fn or 'sổ tay' in fn or 'so tay' in fn or 'clpxbn' in fn or 'liên thông' in fn:
        return 'Quan_Ly_Chat_Luong_ISO', 'Quản Lý Chất Lượng & ISO 15189', 'Quan_Ly_Chat_Luong_ISO'
        
    # 4. An toàn sinh học & Rác thải y tế
    if 'atsh' in rel or 'an toàn sinh học' in fn or 'atsh' in fn or '103.2016' in fn or 'rác thải' in rel or 'rác thải' in fn or '40.2018' in rel or '92.2010' in fn:
        return 'An_Toan_Sinh_Hoc', 'An Toàn Sinh Học & Môi Trường PXN', 'An_Toan_Sinh_Hoc'
        
    # 5. Chuyên môn Vi sinh & Kỹ thuật XN
    if 'vi sinh' in folder or 'vi sinh' in fn or '2633' in fn or '3612' in fn or '6769' in fn or '1539' in fn or '127' in fn or 'kháng sinh' in fn or 'cấy khuẩn' in rel or 'quy trình kỹ thuật' in fn:
        return 'Chuyen_Mon_Vi_Sinh', 'Chuyên Môn Vi Sinh & Kỹ Thuật Xét Nghiệm', 'Chuyen_Mon_Vi_Sinh'

    # 6. Bệnh viện Đức Giang & Sở Y tế
    if 'bệnh viện' in folder or 'sở y tế' in folder or 'đức giang' in fn or 'bệnh viện' in rel or 'tháng' in rel or 'cv mẫu' in rel or 'đơn vị gửi' in folder or '13.2' in folder or '13.4' in folder:
        return 'Benh_Vien_Va_So_Y_Te', 'Văn Bản BVĐK Đức Giang & Sở Y Tế', 'Benh_Vien_Va_So_Y_Te'

    # 7. Văn bản pháp quy, Luật & Thông tư BYT mới
    return 'Van_Ban_Phap_Quy', 'Văn Bản Pháp Quy, Luật & Thông Tư BYT', 'Van_Ban_Phap_Quy'

def main():
    print(f"🔍 Đang quét tài liệu từ: {BASE_DIR}...")
    if not os.path.exists(BASE_DIR):
        print(f"❌ Không tìm thấy thư mục {BASE_DIR}")
        return

    seen_hashes = {}
    raw_items = []

    # Priority traversal
    for item in sorted(os.listdir(BASE_DIR)):
        full_dir = os.path.join(BASE_DIR, item)
        if not os.path.isdir(full_dir): continue
        for r, d, fs in os.walk(full_dir):
            for f in sorted(fs):
                if f.startswith('.') or f.startswith('~$'): continue
                ext = os.path.splitext(f)[1].lower()
                if ext in ['.css', '.tải xuống', '.html', '.svg', '.tải xuống']: continue
                p = os.path.join(r, f)
                h = get_hash(p)
                if h not in seen_hashes:
                    seen_hashes[h] = p
                    raw_items.append({
                        'filename': nfc(f),
                        'path': p,
                        'size': os.path.getsize(p),
                        'folder': nfc(item),
                        'rel_dir': nfc(os.path.relpath(r, BASE_DIR))
                    })

    # Root files
    for f in sorted(os.listdir(BASE_DIR)):
        p = os.path.join(BASE_DIR, f)
        if os.path.isfile(p) and not f.startswith('.'):
            h = get_hash(p)
            if h not in seen_hashes:
                seen_hashes[h] = p
                raw_items.append({
                    'filename': nfc(f),
                    'path': p,
                    'size': os.path.getsize(p),
                    'folder': 'Root',
                    'rel_dir': '.'
                })

    print(f"✅ Đã tìm thấy {len(raw_items)} tệp tài liệu y tế duy nhất.")

    catalog = []
    category_counts = {}

    for idx, it in enumerate(raw_items, start=1):
        cat_key, cat_name, folder_name = classify(it)
        category_counts[cat_name] = category_counts.get(cat_name, 0) + 1
        
        fmt_info = get_file_format_info(it['filename'])
        clean_title = clean_doc_title(it['filename'], it['rel_dir'])
        code = extract_code(it['filename'] + ' ' + it['rel_dir'])
        issuer = extract_issuer(it['rel_dir'], it['filename'])
        year = extract_year(it['filename'] + ' ' + it['rel_dir'])
        
        safe_fn = to_safe_key(it['filename'])
        storage_key = f"Van_Ban_Y_Te/{folder_name}/{safe_fn}"
        storage_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{storage_key}"
        
        # Build search keywords
        keywords = [
            clean_title.lower(),
            remove_vn_tones(clean_title),
            code.lower(),
            cat_name.lower(),
            remove_vn_tones(cat_name),
            issuer.lower(),
            remove_vn_tones(issuer),
            str(year),
            fmt_info['label'].lower()
        ]
        
        # Add extra specialized keywords based on content
        fn_lower = it['filename'].lower()
        if 'kháng sinh' in fn_lower or 'khang sinh' in fn_lower: keywords.append('kháng kháng sinh ksd vi sinh')
        if 'covid' in fn_lower: keywords.append('covid-19 dịch bệnh sars-cov-2 test nhanh pcr')
        if 'nội kiểm' in fn_lower or 'qc' in fn_lower: keywords.append('nội kiểm ngoại kiểm iqc eqas')
        if 'đấu thầu' in fn_lower: keywords.append('mua sắm đấu thầu vật tư trang thiết bị hóa chất')
        if 'iso' in fn_lower: keywords.append('iso 15189 tiêu chuẩn quốc tế công nhận phòng xét nghiệm')
        if 'lao' in fn_lower: keywords.append('bệnh lao phổi afb nuôi cấy mgit')
        if 'viêm gan' in fn_lower: keywords.append('viêm gan b hbsag viêm gan c hcv rna')
        
        doc_entry = {
            'id': f'vb_{idx:03d}',
            'code': code if code else f'VBYT-{idx:03d}',
            'title': clean_title,
            'filename': it['filename'],
            'localPath': it['path'],
            'category': cat_key,
            'categoryName': cat_name,
            'folderName': folder_name,
            'issuer': issuer,
            'year': year,
            'size': it['size'],
            'sizeFormatted': format_size(it['size']),
            'format': fmt_info['type'],
            'formatLabel': fmt_info['label'],
            'formatIcon': fmt_info['icon'],
            'formatClass': fmt_info['cssClass'],
            'storageKey': storage_key,
            'storageUrl': storage_url,
            'keywords': ' '.join(set(' '.join(keywords).split()))
        }
        catalog.append(doc_entry)

    print("\n📊 THỐNG KÊ PHÂN LOẠI:")
    for k, v in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  • {k}: {v} văn bản")

    # Save to js/medical-documents-data.js
    out_js = os.path.join(os.path.dirname(__file__), 'js', 'medical-documents-data.js')
    with open(out_js, 'w', encoding='utf-8') as f:
        f.write("/**\n")
        f.write(" * Danh Mục Văn Bản Y Tế - Khoa Vi Sinh BVĐK Đức Giang\n")
        f.write(f" * Tổng số văn bản: {len(catalog)} văn bản đã được phân loại khoa học\n")
        f.write(" * Đồng bộ: Supabase Storage Bucket ('tai-lieu/Van_Ban_Y_Te')\n")
        f.write(" */\n\n")
        f.write("const MEDICAL_DOCUMENTS_DATA = ")
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        f.write(";\n\n")
        f.write("// Danh mục các nhóm phân loại chuyên môn\n")
        f.write("const MEDICAL_DOC_CATEGORIES = [\n")
        f.write("  { id: 'all', name: 'Tất Cả Văn Bản', icon: '📚' },\n")
        f.write("  { id: 'Chuyen_Mon_Vi_Sinh', name: 'Chuyên Môn Vi Sinh & Kỹ Thuật XN', icon: '🔬' },\n")
        f.write("  { id: 'Quan_Ly_Chat_Luong_ISO', name: 'Quản Lý Chất Lượng & ISO 15189', icon: '🏆' },\n")
        f.write("  { id: 'An_Toan_Sinh_Hoc', name: 'An Toàn Sinh Học & Môi Trường PXN', icon: '☣️' },\n")
        f.write("  { id: 'Phac_Do_Dieu_Tri', name: 'Phác Đồ Chẩn Đoán & Điều Trị Bệnh', icon: '💊' },\n")
        f.write("  { id: 'Van_Ban_Phap_Quy', name: 'Văn Bản Pháp Quy, Luật & Thông Tư BYT', icon: '📜' },\n")
        f.write("  { id: 'Benh_Vien_Va_So_Y_Te', name: 'Văn Bản BVĐK Đức Giang & Sở Y Tế', icon: '🏥' },\n")
        f.write("  { id: 'Phong_Chong_Dich_Covid', name: 'Phòng Chống Dịch & Covid-19', icon: '🛡️' }\n")
        f.write("];\n")

    print(f"\n💾 Đã lưu dữ liệu vào: {out_js}")

    # Save manifest for upload
    out_manifest = os.path.join(os.path.dirname(__file__), 'medical_upload_manifest.json')
    with open(out_manifest, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"💾 Đã lưu manifest tải lên: {out_manifest}")

if __name__ == '__main__':
    main()
