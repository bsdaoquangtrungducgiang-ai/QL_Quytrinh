#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_perfect_medical_catalog.py
Tạo danh mục chuẩn hóa cho toàn bộ 295 Văn bản y tế:
- Chuẩn hóa 'Số Hiệu / Mã' (Code) theo đúng số hiệu pháp quy chuẩn
- Chuẩn hóa 'Tên Văn Bản Y Tế & Nội Dung' (Title & Description) chuẩn văn bản y tế
- Tối ưu hóa từ khóa tìm kiếm nhanh
"""

import json
import os
import re
import unicodedata

def nfc(s):
    return unicodedata.normalize('NFC', s) if s else ''

def remove_vn_tones(text):
    text = nfc(text)
    tones = {
        'à':'a','á':'a','ả':'a','ã':'a','ạ':'a','ă':'a','ằ':'a','ắ':'a','ẳ':'a','ẵ':'a','ặ':'a',
        'â':'a','ầ':'a','ấ':'a','ẩ':'a','ẫ':'a','ậ':'a','đ':'d','è':'e','é':'e','ẻ':'e','ẽ':'e',
        'ẹ':'e','ê':'e','ề':'e','ế':'e','ể':'e','ễ':'e','ệ':'e','ì':'i','í':'i','ỉ':'i','ĩ':'i',
        'ị':'i','ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o','ô':'o','ồ':'o','ố':'o','ổ':'o','ỗ':'o',
        'ộ':'o','ơ':'o','ờ':'o','ớ':'o','ở':'o','ỡ':'o','ợ':'o','ù':'u','ú':'u','ủ':'u','ũ':'u',
        'ụ':'u','ư':'u','ừ':'u','ứ':'u','ử':'u','ữ':'u','ự':'u','ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y'
    }
    res = []
    for c in text.lower():
        res.append(tones.get(c, c))
    return ''.join(res)

def format_size(sz):
    if sz >= 1024 * 1024:
        return f'{sz / (1024*1024):.1f} MB'
    return f'{sz / 1024:.0f} KB'

def main():
    with open('js/medical-documents-data.js', 'r', encoding='utf-8') as f:
        content = f.read()

    m = re.search(r'const MEDICAL_DOCUMENTS_DATA\s*=\s*(\[[\s\S]*?\]);', content)
    if not m:
        print("❌ Không tìm thấy dữ liệu MEDICAL_DOCUMENTS_DATA")
        return

    docs = json.loads(m.group(1))
    print(f"Loaded {len(docs)} documents.")

    # Load headers extracted from previous step if available
    headers_map = {}
    if os.path.exists('scratch_medical_headers.json'):
        with open('scratch_medical_headers.json', 'r', encoding='utf-8') as f:
            h_data = json.load(f)
            for h in h_data:
                headers_map[h['id']] = h

    # Comprehensive rules & refined metadata mapping
    # Maps filename or id or specific patterns to (code, title, issuer, year)
    for d in docs:
        d_id = d['id']
        fn = nfc(d['filename'])
        folder = nfc(d.get('folderName', ''))
        local_p = nfc(d.get('localPath', ''))
        h_info = headers_map.get(d_id, {})
        txt_h = nfc(h_info.get('text_header', ''))
        rel_dir = nfc(os.path.basename(os.path.dirname(local_p)))

        code = d['code']
        title = d['title']
        issuer = d['issuer']
        year = d['year']

        # === 1. Chuyên ngành Vi sinh & Kỹ thuật xét nghiệm ===
        if '2633' in fn or '2633' in rel_dir:
            code = '2633/QĐ-BYT'
            title = 'Quyết định 2633/QĐ-BYT: Hướng dẫn quy trình kỹ thuật về Vi sinh (Tập 1 - Gồm 455 quy trình kỹ thuật vi sinh)'
            issuer = 'Bộ Y tế'
            year = 2025

        elif '1539' in fn or '1539' in rel_dir:
            code = '1539/QĐ-BYT'
            title = 'Quyết định 1539/QĐ-BYT: Hướng dẫn thực hành kỹ thuật xét nghiệm vi sinh lâm sàng phục vụ giám sát kháng thuốc'
            issuer = 'Bộ Y tế'
            year = 2017

        elif '26QĐ' in fn or ('26' in rel_dir and 'vi sinh' in rel_dir.lower()):
            if '3916' in fn.lower():
                code = '3916/QĐ-BYT'
                title = 'Quyết định 3916/QĐ-BYT: Hướng dẫn giám sát nhiễm khuẩn bệnh viện trong các cơ sở khám bệnh, chữa bệnh'
                year = 2017
            elif 'qtkt' in fn.lower() or 'chuan' in fn.lower():
                code = '26/QĐ-BYT'
                title = 'Quyết định 26/QĐ-BYT: Tài liệu hướng dẫn quy trình kỹ thuật chuyên ngành Vi sinh Y học'
                year = 2013
            else:
                code = '26/QĐ-BYT'
                title = 'Quyết định 26/QĐ-BYT: Ban hành hướng dẫn quy trình kỹ thuật chuyên ngành Vi sinh Y học'
                year = 2013
            issuer = 'Bộ Y tế'

        elif '6769' in fn or '6769' in rel_dir:
            code = '6769/QĐ-BYT'
            title = 'Quyết định 6769/QĐ-BYT: Hướng dẫn quy trình kỹ thuật chuyên ngành Vi sinh (Tập 1 - Ban hành 83 quy trình chuẩn)'
            issuer = 'Bộ Y tế'
            year = 2018

        elif '2429' in fn or '2429' in rel_dir:
            if 'bang kiem' in fn.lower() or 'biểu mẫu' in fn.lower() or 'excel' in fn.lower() or 'mẫu đánh giá' in fn.lower() or 'mấu' in fn.lower():
                code = 'BM-2429'
                title = 'Bảng kiểm đánh giá mức chất lượng phòng xét nghiệm y học (Theo QĐ 2429/QĐ-BYT)'
            elif 'ds lien thong' in fn.lower() or 'danh sách xét nghiệm vi sinh liên thông' in fn.lower():
                code = 'LT-XN-VS'
                title = 'Danh mục các kỹ thuật xét nghiệm Vi sinh được công nhận liên thông kết quả giữa các cơ sở khám chữa bệnh'
            elif 'so tay' in fn.lower():
                code = 'ST-CLPXN-2429'
                title = 'Sổ tay hướng dẫn đánh giá việc thực hiện Tiêu chí đánh giá mức chất lượng phòng xét nghiệm y học'
            else:
                code = '2429/QĐ-BYT'
                title = 'Quyết định 2429/QĐ-BYT: Ban hành Tiêu chí đánh giá mức chất lượng phòng xét nghiệm y học'
            issuer = 'Bộ Y tế'
            year = 2017

        elif '3612' in fn or '3612' in rel_dir:
            code = '3612/QĐ-BYT'
            if 'lấy mẫu' in fn.lower():
                title = 'Quyết định 3612/QĐ-BYT: Hướng dẫn chỉ định, lấy mẫu và sử dụng xét nghiệm Vi sinh lâm sàng'
            else:
                title = 'Quyết định 3612/QĐ-BYT: Hướng dẫn chỉ định và sử dụng xét nghiệm Vi sinh lâm sàng trong chẩn đoán, điều trị'
            issuer = 'Bộ Y tế'
            year = 2025

        elif '5530' in fn or '5530' in rel_dir:
            code = '5530/QĐ-BYT'
            title = 'Quyết định 5530/QĐ-BYT: Hướng dẫn xây dựng quy trình thực hành chuẩn (SOP) trong quản lý chất lượng xét nghiệm'
            issuer = 'Bộ Y tế'
            year = 2015

        elif '127' in fn or '127' in rel_dir:
            code = '127/QĐ-BYT'
            title = 'Quyết định 127/QĐ-BYT: Hướng dẫn thực hiện giám sát quốc gia về kháng kháng sinh trong các cơ sở y tế'
            issuer = 'Bộ Y tế'
            year = 2018

        elif '6211' in fn or '6211' in rel_dir:
            code = '6211/QĐ-BYT'
            title = 'Quyết định 6211/QĐ-BYT: Quy định thiết lập và vận hành hệ thống giám sát kháng thuốc tại các bệnh viện'
            issuer = 'Bộ Y tế'
            year = 2016

        elif 'gia m-sat-khang-thuoc' in fn.lower() or 'kháng thuốc' in fn.lower():
            code = 'GS-KT-BYT'
            title = 'Tài liệu hướng dẫn quy định thiết lập hệ thống giám sát vi sinh vật kháng thuốc trong bệnh viện'
            issuer = 'Bộ Y tế'
            year = 2016

        # === 2. Luật KBCB, Thông tư 32/2023 & Phụ lục chuyên môn ===
        elif '32.2024' in rel_dir or '32.2023' in rel_dir or 'tt 32' in rel_dir.lower():
            issuer = 'Bộ Y tế'
            year = 2023
            if '0.-thong-tu' in fn.lower():
                code = '32/2023/TT-BYT'
                title = 'Thông tư 32/2023/TT-BYT: Quy định chi tiết một số điều của Luật Khám bệnh, chữa bệnh 2023'
            elif 'phu-luc-i-iv' in fn.lower():
                code = 'TT32-PL.I-IV'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục I-IV: Quy định cập nhật kiến thức y khoa liên tục (CME) trong KBCB'
            elif 'phu-luc-v' in fn.lower():
                code = 'TT32-PL.V'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục V: Danh mục kỹ thuật chuyên môn của Người hành nghề Bác sỹ Y khoa'
            elif 'phu-luc-vi' in fn.lower():
                code = 'TT32-PL.VI'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục VI: Danh mục kỹ thuật chuyên môn của Bác sỹ Y học cổ truyền'
            elif 'phu-luc-vii' in fn.lower():
                code = 'TT32-PL.VII'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục VII: Danh mục kỹ thuật chuyên môn của Bác sỹ Y học dự phòng'
            elif 'phu-luc-viii' in fn.lower():
                code = 'TT32-PL.VIII'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục VIII: Danh mục kỹ thuật chuyên môn của Bác sỹ Răng Hàm Mặt'
            elif 'phu-luc-ix' in fn.lower():
                code = 'TT32-PL.IX'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục IX: Danh mục kỹ thuật chuyên môn của Bác sỹ Chuyên khoa'
            elif 'phu-luc-x-' in fn.lower():
                code = 'TT32-PL.X'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục X: Danh mục kỹ thuật chuyên môn của Người hành nghề Y sỹ đa khoa'
            elif 'phu-luc-xi-' in fn.lower():
                code = 'TT32-PL.XI'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XI: Danh mục kỹ thuật chuyên môn của Y sỹ Y học cổ truyền'
            elif 'phu-luc-xii' in fn.lower():
                code = 'TT32-PL.XII'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XII: Danh mục kỹ thuật chuyên môn chức danh Điều dưỡng'
            elif 'phu-luc-xiii' in fn.lower():
                code = 'TT32-PL.XIII'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XIII: Danh mục kỹ thuật chuyên môn chức danh Hộ sinh'
            elif 'phu-luc-xiv' in fn.lower():
                code = 'TT32-PL.XIV'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XIV: Danh mục kỹ thuật chuyên môn Kỹ thuật y (Xét nghiệm, Chẩn đoán hình ảnh)'
            elif 'phu-luc-xv' in fn.lower():
                code = 'TT32-PL.XV'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XV: Danh mục kỹ thuật chuyên môn chức danh Dinh dưỡng lâm sàng'
            elif 'phu-luc-xvi' in fn.lower():
                code = 'TT32-PL.XVI'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XVI: Danh mục kỹ thuật chuyên môn chức danh Tâm lý lâm sàng'
            elif 'phu-luc-xvii' in fn.lower():
                code = 'TT32-PL.XVII'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XVII: Danh mục kỹ thuật chuyên môn chức danh Lương y'
            elif 'phu-luc-xviii' in fn.lower():
                code = 'TT32-PL.XVIII'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XVIII: Danh mục kỹ thuật chuyên môn chức danh Cấp cứu ngoại viện'
            elif 'phu-luc-xix' in fn.lower():
                code = 'TT32-PL.XIX'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XIX: Danh mục kỹ thuật chuyên môn chức danh Khúc xạ nhãn khoa'
            elif 'phu-luc-xx' in fn.lower():
                code = 'TT32-PL.XX'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XX: Quy định hồ sơ, thủ tục cấp giấy phép hành nghề khám chữa bệnh'
            elif 'phu-luc-xxi' in fn.lower():
                code = 'TT32-PL.XXI'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XXI: Quy định mẫu hồ sơ bệnh án và quản lý dữ liệu khám chữa bệnh'
            elif 'phu-luc-xxii' in fn.lower():
                code = 'TT32-PL.XXII'
                title = 'Thông tư 32/2023/TT-BYT - Phụ lục XXII: Quy định về kiểm soát nhiễm khuẩn trong cơ sở khám chữa bệnh'
            else:
                code = '32/2023/TT-BYT'
                title = f'Thông tư 32/2023/TT-BYT: Tài liệu hướng dẫn thi hành Luật Khám bệnh, chữa bệnh 2023 ({fn})'

        # === 3. Phụ lục phân tuyến kỹ thuật Thông tư 43/2013/TT-BYT ===
        elif 'phu luc thong tu 43' in rel_dir.lower() or ('43' in rel_dir and '2013' in fn):
            issuer = 'Bộ Y tế'
            year = 2013
            m_sec = re.search(r'([0-9]+)\.\s*([A-Za-zÀ-ỹ\s\-_]+)\s*2013', fn)
            sec_num = m_sec.group(1) if m_sec else ''
            sec_name = m_sec.group(2).strip() if m_sec else fn
            
            # Specific clean names for specialties
            spec_map = {
                'Hoi suc cap cuu- chong doc': 'Hồi sức cấp cứu và Chống độc',
                'Noi khoa': 'Nội khoa',
                'Nhi khoa': 'Nhi khoa',
                'Truyen nhiem': 'Truyền nhiễm',
                'Lao va benh phoi': 'Lao và Bệnh phổi',
                'Da lieu': 'Da liễu',
                'Than kinh': 'Thần kinh',
                'Tam than': 'Tâm thần',
                'Y hoc co truyen': 'Y học cổ truyền',
                'Ngoai khoa': 'Ngoai khoa',
                'Bong': 'Bỏng',
                'Ung buou': 'Ung bướu',
                'Phu san': 'Phụ sản',
                'Mat': 'Mắt',
                'Tai Mui Hong': 'Tai Mũi Họng',
                'Rang Ham Mat': 'Răng Hàm Mặt',
                'Phuc hoi chuc nang': 'Phục hồi chức năng',
                'Dien quang': 'Điện quang - Chẩn đoán hình ảnh',
                'Y hoc hat nhan': 'Y học hạt nhân',
                'Xa tri': 'Xạ trị',
                'Tham do chuc nang': 'Thăm dò chức năng',
                'Huyet hoc truyen mau': 'Huyết học - Truyền máu',
                'Hoa sinh': 'Hóa sinh',
                'Vi sinh': 'Vi sinh',
                'Giai phau benh': 'Giải phẫu bệnh',
                'Dinh duong': 'Dinh dưỡng',
                'Kiem soat nhiem khuan': 'Kiểm soát nhiễm khuẩn',
                'Gay me hoi suc': 'Gây mê hồi sức'
            }
            spec_title = spec_map.get(sec_name, sec_name)
            code = f'TT43-CK.{sec_num}' if sec_num else '43/2013/TT-BYT'
            title = f'Thông tư 43/2013/TT-BYT: Phụ lục danh mục phân tuyến chuyên môn kỹ thuật - Chuyên khoa {spec_title}'

        # === 4. Giá dịch vụ y tế & BHYT (TT 13, TT 21, TT 22, TT 15, TT 37, TT 39, TT 50) ===
        elif 'thong-tu-13-2023' in fn.lower() or ('13.2023' in rel_dir.lower() and 'kham-chua-benh' in fn.lower()):
            code = '13/2023/TT-BYT'
            title = 'Thông tư 13/2023/TT-BYT: Khung giá và phương pháp định giá dịch vụ khám bệnh, chữa bệnh theo yêu cầu'
            issuer = 'Bộ Y tế'
            year = 2023

        elif 'tt 13. vi sinh giá' in fn.lower():
            code = 'TT13-BG-VS'
            title = 'Thông tư 13/2023/TT-BYT: Bảng cơ cấu giá và chi phí xét nghiệm Vi sinh thực hiện theo yêu cầu'
            issuer = 'Bộ Y tế'
            year = 2023

        elif 'thông tư-22-2023' in fn.lower() or 'tt 22.2023' in rel_dir.lower() or '22-byt-kem' in fn.lower():
            code = '22/2023/TT-BYT'
            if 'kem' in fn.lower() or 'xls' in fn.lower():
                title = 'Thông tư 22/2023/TT-BYT: Bảng giá chi tiết dịch vụ khám bệnh, chữa bệnh BHYT chuyên ngành Xét nghiệm'
            else:
                title = 'Thông tư 22/2023/TT-BYT: Quy định giá dịch vụ khám bệnh, chữa bệnh bảo hiểm y tế'
            issuer = 'Bộ Y tế'
            year = 2023

        elif 'tt. 21.2023' in fn.lower() or 'tt. 21.2024' in fn.lower() or '21. 2024' in rel_dir.lower():
            if '2024' in fn.lower():
                code = '21/2024/TT-BYT'
                title = 'Thông tư 21/2024/TT-BYT: Quy định phương pháp định giá dịch vụ khám bệnh, chữa bệnh'
                year = 2024
            else:
                code = '21/2023/TT-BYT'
                title = 'Thông tư 21/2023/TT-BYT: Quy định khung giá và định mức kinh tế kỹ thuật dịch vụ khám chữa bệnh'
                year = 2023
            issuer = 'Bộ Y tế'

        elif '49.2018' in fn.lower() or '49.2018' in rel_dir.lower():
            code = '49/2018/TT-BYT'
            title = 'Thông tư 49/2018/TT-BYT: Hướng dẫn hoạt động xét nghiệm trong khám bệnh, chữa bệnh'
            issuer = 'Bộ Y tế'
            year = 2018

        elif 'tt 15' in rel_dir.lower() or '15.2018' in fn.lower():
            code = '15/2018/TT-BYT'
            title = 'Thông tư 15/2018/TT-BYT: Quy định thống nhất giá dịch vụ khám bệnh, chữa bệnh BHYT giữa các bệnh viện'
            issuer = 'Bộ Y tế'
            year = 2018

        elif '37.39' in rel_dir.lower() or '37.2018' in rel_dir.lower() or '39.2018' in rel_dir.lower():
            code = 'TT37/39-BYT'
            if 'tong hop' in fn.lower():
                title = 'Bảng tổng hợp danh mục giá dịch vụ kỹ thuật xét nghiệm Vi sinh theo Thông tư 37 và 39/2018/TT-BYT'
            else:
                title = 'Thông tư 37 & 39/2018/TT-BYT: Quy định mức giá tối đa dịch vụ kỹ thuật y tế và khám chữa bệnh BHYT'
            issuer = 'Bộ Y tế'
            year = 2018

        elif '50.2017' in fn.lower() or '50.2017' in rel_dir.lower():
            code = '50/2017/TT-BYT'
            title = 'Thông tư 50/2017/TT-BYT: Sửa đổi, bổ sung quy định liên quan đến thanh toán chi phí khám chữa bệnh BHYT'
            issuer = 'Bộ Y tế'
            year = 2017

        elif '33-2016' in fn.lower() or 'tt 33.2016' in rel_dir.lower():
            code = '33/2016/TT-BYT'
            title = 'Thông tư 33/2016/TT-BYT: Quy định về tổ chức và hoạt động xét nghiệm vi sinh trong bệnh viện'
            issuer = 'Bộ Y tế'
            year = 2016

        # === 5. An toàn sinh học & Quản lý chất thải (NĐ 103, NĐ 155, TT 37, TT 41, TT 43, TT 58) ===
        elif '103.2016' in fn.lower() or '103. 2016' in rel_dir.lower():
            code = '103/2016/NĐ-CP'
            title = 'Nghị định 103/2016/NĐ-CP: Quy định về bảo đảm an toàn sinh học tại phòng xét nghiệm'
            issuer = 'Chính phủ'
            year = 2016

        elif '155.2018' in fn.lower():
            code = '155/2018/NĐ-CP'
            title = 'Nghị định 155/2018/NĐ-CP: Sửa đổi, bổ sung quy định về an toàn sinh học phòng xét nghiệm y học'
            issuer = 'Chính phủ'
            year = 2018

        elif '37_2017_tt-byt' in fn.lower():
            code = '37/2017/TT-BYT'
            title = 'Thông tư 37/2017/TT-BYT: Quy định về thực hành xét nghiệm an toàn sinh học tại các cơ sở y tế'
            issuer = 'Bộ Y tế'
            year = 2017

        elif '41:2016' in fn.lower() or '41.2016' in fn.lower():
            code = '41/2016/TT-BYT'
            title = 'Thông tư 41/2016/TT-BYT: Ban hành Danh mục vi sinh vật gây bệnh truyền nhiễm theo nhóm nguy cơ và cấp độ ATSH'
            issuer = 'Bộ Y tế'
            year = 2016

        elif '43 :2011' in fn.lower() or '43.2011' in fn.lower() or '43/2011' in txt_h:
            code = '43/2011/TT-BYT'
            title = 'Thông tư 43/2011/TT-BYT: Quy định chế độ quản lý mẫu bệnh phẩm bệnh truyền nhiễm'
            issuer = 'Bộ Y tế'
            year = 2011

        elif '40-2018' in fn.lower() or 'tt 40.2018' in rel_dir.lower():
            code = '40/2018/TT-BYT'
            title = 'Thông tư 40/2018/TT-BYT: Quy định về quản lý mẫu bệnh phẩm bệnh truyền nhiễm'
            issuer = 'Bộ Y tế'
            year = 2018

        elif 'tt58.2015' in fn.lower():
            code = '58/2015/TTLT-BYT-BTNMT'
            title = 'Thông tư liên tịch 58/2015/TTLT-BYT-BTNMT: Quy định về quản lý chất thải y tế'
            issuer = 'Bộ Y tế & Bộ TNMT'
            year = 2015

        elif 'nihe- tong quan' in fn.lower():
            code = 'TL-NIHE-ATSH'
            title = 'Tài liệu Viện Vệ sinh Dịch tễ Trung ương (NIHE): Tổng quan An toàn sinh học phòng xét nghiệm'
            issuer = 'Viện VSDTTW'
            year = 2019

        elif 'quy định nồi hấp' in fn.lower():
            code = 'QĐ-NH-VS'
            title = 'Hướng dẫn chuyên môn: Quy định xử lý tiệt trùng rác thải y tế và vận hành nồi hấp tại Khoa Vi sinh'
            issuer = 'BVĐK Đức Giang'
            year = 2021

        elif 'công bố an toàn sinh học' in fn.lower():
            code = 'CB-ATSH-ĐG'
            title = 'Bản công bố cơ sở xét nghiệm đạt tiêu chuẩn an toàn sinh học cấp II - BVĐK Đức Giang'
            issuer = 'BVĐK Đức Giang'
            year = 2019

        # === 6. Giám sát chất lượng nước chạy thận & cấy khuẩn (QĐ 2482/QĐ-BYT) ===
        elif '2482' in fn:
            code = '2482/QĐ-BYT'
            title = 'Quyết định 2482/QĐ-BYT: Hướng dẫn quy trình kỹ thuật thận nhân tạo và tiêu chuẩn kiểm soát chất lượng nước RO'
            issuer = 'Bộ Y tế'
            year = 2018

        elif 'tổng số vi khuẩn hiếu khí' in fn.lower():
            code = 'QT-VKHK-RO'
            title = 'Quy trình kỹ thuật: Hướng dẫn xác định tổng số vi khuẩn hiếu khí trong mẫu nước lọc thận nhân tạo'
            issuer = 'Bộ Y tế'
            year = 2018

        elif 'xét nghiệm giám sát chất lượng nước lọc thận' in rel_dir.lower():
            code = f'TL-RO-{d_id.split("_")[-1]}'
            title = f'Tài liệu hướng dẫn trực quan: Giám sát vi sinh & chất lượng nước chạy thận nhân tạo ({fn})'
            issuer = 'BVĐK Đức Giang'
            year = 2018

        # === 7. Trang thiết bị y tế & Đấu thầu (NĐ 98, NĐ 07, NĐ 04, NĐ 96, NQ 30, NĐ 24) ===
        elif 'nd.04.2025' in fn.lower() or 'nđ 04' in rel_dir.lower():
            code = '04/2025/NĐ-CP'
            title = 'Nghị định 04/2025/NĐ-CP: Sửa đổi, bổ sung một số điều của Nghị định 98/2021/NĐ-CP về quản lý trang thiết bị y tế'
            issuer = 'Chính phủ'
            year = 2025

        elif 'nghi-dinh-07-2023' in fn.lower() or 'nđ. 07' in rel_dir.lower():
            code = '07/2023/NĐ-CP'
            title = 'Nghị định 07/2023/NĐ-CP: Sửa đổi, bổ sung một số điều của Nghị định 98/2021/NĐ-CP về trang thiết bị y tế'
            issuer = 'Chính phủ'
            year = 2023

        elif '98-2021' in fn.lower() or 'nđ 98' in rel_dir.lower():
            code = '98/2021/NĐ-CP'
            title = 'Nghị định 98/2021/NĐ-CP: Quy định về quản lý trang thiết bị y tế'
            issuer = 'Chính phủ'
            year = 2021

        elif 'nq 30' in fn.lower():
            code = '30/NQ-CP'
            title = 'Nghị quyết 30/NQ-CP: Về việc tiếp tục thực hiện các giải pháp bảo đảm thuốc, trang thiết bị y tế'
            issuer = 'Chính phủ'
            year = 2023

        elif 'nghi-dinh-96-2023' in fn.lower() or 'nđ 96' in rel_dir.lower():
            code = '96/2023/NĐ-CP'
            title = 'Nghị định 96/2023/NĐ-CP: Quy định chi tiết một số điều của Luật Khám bệnh, chữa bệnh 2023'
            issuer = 'Chính phủ'
            year = 2023

        elif 'nghi-dinh-24-2024' in fn.lower() or 'nđ24' in rel_dir.lower():
            code = '24/2024/NĐ-CP'
            title = 'Nghị định 24/2024/NĐ-CP: Quy định chi tiết một số điều và biện pháp thi hành Luật Đấu thầu về lựa chọn nhà thầu'
            issuer = 'Chính phủ'
            year = 2024

        elif 'nghi-dinh-116-2024' in fn.lower() or 'nđ 116' in rel_dir.lower():
            code = '116/2024/NĐ-CP'
            title = 'Nghị định 116/2024/NĐ-CP: Sửa đổi, bổ sung một số điều về tuyển dụng, sử dụng và quản lý công chức, viên chức'
            issuer = 'Chính phủ'
            year = 2024

        elif '2538' in fn.lower() or '2538' in rel_dir.lower():
            code = '2538/QĐ-BYT'
            title = 'Quyết định 2538/QĐ-BYT: Ban hành Danh mục chuyên môn kỹ thuật trong khám bệnh, chữa bệnh'
            issuer = 'Bộ Y tế'
            year = 2023

        elif 'nghi-dinh-92-2010' in fn.lower() or 'nđ 92' in rel_dir.lower():
            code = '92/2010/NĐ-CP'
            title = 'Nghị định 92/2010/NĐ-CP: Quy định chi tiết thi hành Luật Bảo hiểm y tế'
            issuer = 'Chính phủ'
            year = 2010

        # === 8. Phác đồ chẩn đoán, điều trị & Hướng dẫn chuyên môn Bộ Y tế ===
        elif '5186' in fn or 'giang mai' in rel_dir.lower():
            code = '5186/QĐ-BYT'
            title = 'Quyết định 5186/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị bệnh Giang mai (Kỹ thuật xét nghiệm RPR, TPHA, FTA-ABS)'
            issuer = 'Bộ Y tế'
            year = 2021

        elif '3429' in fn or 'nấm' in rel_dir.lower():
            code = '3429/QĐ-BYT'
            title = 'Quyết định 3429/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị bệnh Nấm xâm lấn (Nhuộm soi, nuôi cấy và định danh nấm)'
            issuer = 'Bộ Y tế'
            year = 2021

        elif '5165' in fn or 'lậu' in rel_dir.lower():
            code = '5165/QĐ-BYT'
            title = 'Quyết định 5165/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị bệnh Lậu (Nhuộm soi Gram, cấy Neisseria gonorrhoeae, Real-time PCR)'
            issuer = 'Bộ Y tế'
            year = 2021

        elif '4815' in fn or 'viêm phổi' in rel_dir.lower():
            code = '4815/QĐ-BYT'
            title = 'Quyết định 4815/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị Viêm phổi mắc phải cộng đồng ở người lớn'
            issuer = 'Bộ Y tế'
            year = 2020

        elif '2760' in fn or 'dengue' in rel_dir.lower() or 'sốt xuất huyết' in rel_dir.lower():
            code = '2760/QĐ-BYT'
            title = 'Quyết định 2760/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị Sốt xuất huyết Dengue (Xét nghiệm NS1Ag, kháng thể IgM/IgG, RT-PCR)'
            issuer = 'Bộ Y tế'
            year = 2023

        elif '5169' in fn or 'chlamydia' in rel_dir.lower():
            code = '5169/QĐ-BYT'
            title = 'Quyết định 5169/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị bệnh Chlamydia trachomatis (Real-time PCR và test nhanh)'
            issuer = 'Bộ Y tế'
            year = 2021

        elif '2671' in fn:
            code = '2671/QĐ-BYT'
            title = 'Quyết định 2671/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị Covid-19 ở trẻ em'
            issuer = 'Bộ Y tế'
            year = 2021

        elif 'viêm gan vi rút a' in fn.lower() or 'viêm gan a' in rel_dir.lower():
            code = '3457/QĐ-BYT'
            title = 'Quyết định 3457/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị bệnh Viêm gan vi rút A (Xét nghiệm Anti-HAV IgM)'
            issuer = 'Bộ Y tế'
            year = 2020

        elif '5642' in fn:
            code = '5642/QĐ-BYT'
            title = 'Quyết định 5642/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị một số bệnh truyền nhiễm nguy hiểm'
            issuer = 'Bộ Y tế'
            year = 2015

        elif '2322' in fn or 'viêm não' in rel_dir.lower():
            code = '2322/QĐ-BYT'
            title = 'Quyết định 2322/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị bệnh Viêm não Nhật Bản và viêm não vi rút'
            issuer = 'Bộ Y tế'
            year = 2014

        elif '292' in fn or '1003' in fn or 'chân tay miệng' in rel_dir.lower():
            if '292' in fn:
                code = '292/QĐ-BYT'
                title = 'Quyết định 292/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị bệnh Tay - Chân - Miệng (Cập nhật 2024)'
                year = 2024
            else:
                code = '1003/QĐ-BYT'
                title = 'Quyết định 1003/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị bệnh Tay - Chân - Miệng'
                year = 2012
            issuer = 'Bộ Y tế'

        elif '3451' in fn or 'adenovirus' in rel_dir.lower():
            code = '3451/QĐ-BYT'
            title = 'Quyết định 3451/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị và phòng lây nhiễm bệnh do Adenovirus'
            issuer = 'Bộ Y tế'
            year = 2022

        elif '5968' in fn or 'hiv' in rel_dir.lower():
            code = '5968/QĐ-BYT'
            title = 'Quyết định 5968/QĐ-BYT: Hướng dẫn điều trị và chăm sóc HIV/AIDS (Chiến lược xét nghiệm khẳng định HIV và đo tải lượng HIV-RNA)'
            issuer = 'Bộ Y tế'
            year = 2021

        elif 'da-lieu' in fn.lower() or 'da liễu' in rel_dir.lower():
            code = '75/QĐ-BYT'
            title = 'Quyết định 75/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị các bệnh Da liễu (Nhuộm soi vi nấm, ký sinh trùng)'
            issuer = 'Bộ Y tế'
            year = 2015

        elif 'hpv' in rel_dir.lower():
            if '1639' in fn:
                code = '1639/QĐ-BYT'
                title = 'Quyết định 1639/QĐ-BYT: Hướng dẫn kỹ thuật sàng lọc, phát hiện sớm ung thư cổ tử cung và xét nghiệm HPV'
            else:
                code = '5185/QĐ-BYT'
                title = 'Quyết định 5185/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị tổn thương tiền ung thư cổ tử cung & nhiễm HPV'
            issuer = 'Bộ Y tế'
            year = 2021

        elif 'cúm mùa' in rel_dir.lower() or 'cúm mùa' in rel_dir.lower():
            if '1840' in fn:
                code = '1840/QĐ-BYT'
                title = 'Quyết định 1840/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị bệnh Cúm mùa (Test nhanh Cúm A/B và RT-PCR)'
            else:
                code = '2078/QĐ-BYT'
                title = 'Quyết định 2078/QĐ-BYT: Hướng dẫn chuyên môn về giám sát và chẩn đoán bệnh Cúm mùa'
            issuer = 'Bộ Y tế'
            year = 2020

        elif '5450' in fn or 'viêm gan e' in rel_dir.lower():
            code = '5450/QĐ-BYT'
            title = 'Quyết định 5450/QĐ-BYT: Hướng dẫn chẩn đoán và điều trị bệnh Viêm gan vi rút E (Xét nghiệm Anti-HEV IgM/IgG)'
            issuer = 'Bộ Y tế'
            year = 2020

        elif '3310' in fn or 'viên gan b' in rel_dir.lower() or 'viêm gan b' in rel_dir.lower():
            code = '3310/QĐ-BYT'
            title = 'Quyết định 3310/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị bệnh Viêm gan vi rút B (Đo tải lượng HBV-DNA, HBsAg định lượng)'
            issuer = 'Bộ Y tế'
            year = 2019

        elif '2065' in fn or 'viêm gan c' in rel_dir.lower():
            code = '2065/QĐ-BYT'
            title = 'Quyết định 2065/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị bệnh Viêm gan vi rút C (Đo tải lượng HCV-RNA và định type HCV)'
            issuer = 'Bộ Y tế'
            year = 2021

        elif 'lao' in rel_dir.lower() or '4263' in fn or '162.2024' in fn:
            if '162' in fn:
                code = '162/QĐ-BYT'
                title = 'Quyết định 162/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị và dự phòng bệnh Lao (Cập nhật 2024)'
                year = 2024
            else:
                code = '4263/QĐ-BYT'
                title = 'Quyết định 4263/QĐ-BYT: Hướng dẫn chẩn đoán, điều trị và dự phòng bệnh Lao (Kỹ thuật AFB, nuôi cấy MGIT và GeneXpert)'
                year = 2020
            issuer = 'Bộ Y tế'

        elif '468' in fn or 'qđ 468' in rel_dir.lower():
            code = '468/QĐ-BYT'
            title = 'Quyết định 468/QĐ-BYT: Hướng dẫn phòng và kiểm soát lây nhiễm bệnh viêm đường hô hấp cấp do SARS-CoV-2'
            issuer = 'Bộ Y tế'
            year = 2020

        # === 9. Văn bản phòng chống dịch Covid-19 ===
        elif '1282' in fn:
            code = '1282/QĐ-BYT'
            title = 'Quyết định 1282/QĐ-BYT: Hướng dẫn tạm thời xét nghiệm Covid-19 trong cơ sở khám chữa bệnh'
            issuer = 'Bộ Y tế'
            year = 2020

        elif '1983' in fn:
            code = '1983/CV-BCĐQG'
            title = 'Công văn 1983/CV-BCĐQG: Hướng dẫn về mức giá và cơ chế thu xét nghiệm sàng lọc Covid-19'
            issuer = 'BCĐ Quốc gia Covid-19'
            year = 2020

        elif '963' in fn:
            code = '963/QĐ-BYT'
            title = 'Quyết định 963/QĐ-BYT: Hướng dẫn tạm thời giám sát và phòng, chống dịch bệnh Covid-19'
            issuer = 'Bộ Y tế'
            year = 2020

        elif '272' in fn:
            code = '272/QĐ-SYT'
            title = 'Quyết định 272/QĐ-SYT: Phân công nhiệm vụ các bệnh viện thực hiện xét nghiệm sàng lọc và điều trị Covid-19'
            issuer = 'Sở Y tế Hà Nội'
            year = 2020

        elif '774' in fn:
            code = '774/QĐ-BYT'
            title = 'Quyết định 774/QĐ-BYT: Ban hành số đăng ký lưu hành sinh phẩm chẩn đoán in vitro xét nghiệm SARS-CoV-2'
            issuer = 'Bộ Y tế'
            year = 2020

        elif '1898' in fn:
            code = '1898/CĐ-BCĐQG'
            title = 'Công điện 1898/CĐ-BCĐQG: Tăng cường phòng và kiểm soát lây nhiễm Covid-19 trong các cơ sở khám chữa bệnh'
            issuer = 'BCĐ Quốc gia Covid-19'
            year = 2020

        elif 'test nhanh' in fn.lower() and 'bệnh viện' in rel_dir.lower():
            if '672' in fn:
                code = '672/CV-BVĐKĐG'
                title = 'Công văn 672/CV-BVĐKĐG: Triển khai sử dụng Test nhanh kháng nguyên phát hiện SARS-CoV-2'
            elif '271' in fn:
                code = '271/CV-BVĐKĐG'
                title = 'Công văn 271/CV-BVĐKĐG: Phân bổ và quản lý sinh phẩm test nhanh Covid-19 tại các khoa lâm sàng'
            elif '87' in fn:
                code = '87/QĐ-BVĐKĐG'
                title = 'Quyết định 87/QĐ-BVĐKĐG: Thành lập Ban Chỉ đạo phòng chống dịch bệnh viêm đường hô hấp cấp Covid-19'
            elif '462' in fn:
                code = '462/CV-BVĐKĐG'
                title = 'Công văn 462/CV-BVĐKĐG: Đề nghị hỗ trợ vật tư và test xét nghiệm sàng lọc Covid-19'
            else:
                code = f'HD-XN-ĐG'
                title = f'Hướng dẫn quy trình xét nghiệm test nhanh sàng lọc SARS-CoV-2 tại BVĐK Đức Giang ({fn})'
            issuer = 'BVĐK Đức Giang'
            year = 2020

        elif 'sở y tế' in rel_dir.lower() and ('covid' in rel_dir.lower() or 'covid' in fn.lower()):
            if '209' in fn:
                code = '209/CV-SYT'
                title = 'Công văn 209/CV-SYT: Sở Y tế Hà Nội phân bổ test nhanh chẩn đoán Covid-19 cho các cơ sở y tế'
            elif '365' in fn:
                code = '365/CV-SYT'
                title = 'Công văn 365/CV-SYT: Hướng dẫn thực hiện xét nghiệm sàng lọc Covid-19 tại các cơ sở khám chữa bệnh'
            elif '427' in fn:
                code = '427/CV-SYT'
                title = 'Công văn 427/CV-SYT: Hướng dẫn chỉ định và sử dụng xét nghiệm nhanh phát hiện kháng thể SARS-CoV-2'
            elif '1868' in fn or '453' in fn:
                code = '1868/CV-SYT' if '1868' in fn else '453/CV-SYT'
                title = 'Công văn Sở Y tế Hà Nội: Cập nhật tài liệu hướng dẫn công tác chẩn đoán, xét nghiệm và điều trị Covid-19'
            elif 'khai báo' in fn.lower():
                code = 'BM-KB-XN'
                title = 'Biểu mẫu thống kê và khai báo kết quả xét nghiệm test nhanh Covid-19 gửi Sở Y tế'
            else:
                code = 'CV-SYT-COVID'
                title = f'Công văn Sở Y tế Hà Nội về chỉ đạo phòng chống dịch và xét nghiệm Covid-19 ({fn})'
            issuer = 'Sở Y tế Hà Nội'
            year = 2020

        # === 10. Văn bản chỉ đạo, nội bộ & triển khai kỹ thuật BVĐK Đức Giang ===
        elif 'thông báo triển khai kỹ thuật' in rel_dir.lower():
            issuer = 'BVĐK Đức Giang'
            year = 2020
            if '2063' in fn:
                code = '2063/TB-BVĐKĐG'
                title = 'Thông báo 2063/TB-BVĐKĐG: Hướng dẫn chỉ định xét nghiệm và phối hợp liên khoa Hóa sinh - Vi sinh'
            elif '2124' in fn or 'hbv' in fn.lower():
                code = '2124/TB-BVĐKĐG'
                title = 'Thông báo 2124/TB-BVĐKĐG: Triển khai kỹ thuật đo tải lượng HBV-DNA tự động trên hệ thống Real-time PCR'
            elif 'hpv' in fn.lower() or '201124' in fn:
                code = 'TB-PCR-HPV'
                title = 'Thông báo triển khai kỹ thuật xét nghiệm HPV Genotype Real-time PCR chẩn đoán sàng lọc ung thư CTC'
            elif '1999' in fn:
                code = '1999/TB-BVĐKĐG'
                title = 'Thông báo 1999/TB-BVĐKĐG: Triển khai kỹ thuật xét nghiệm mới trên hệ thống máy Real-time PCR'
            else:
                code = 'TB-KT-ĐG'
                title = f'Thông báo triển khai danh mục kỹ thuật xét nghiệm mới tại Khoa Vi sinh BVĐK Đức Giang ({fn})'

        elif 'quyết định thành lập ban quản lý chất lượng' in fn.lower():
            code = 'QĐ-QLCL-ĐG'
            title = 'Quyết định thành lập Ban Quản lý Chất lượng Khối Xét nghiệm (Vi sinh, Hóa sinh, Huyết học) - BVĐK Đức Giang'
            issuer = 'BVĐK Đức Giang'
            year = 2024

        elif 'biên bản phân công nhiệm vụ ban qlcl' in fn.lower():
            code = 'BB-QLCL-ĐG'
            title = 'Biên bản phân công nhiệm vụ thành viên Ban Quản lý Chất lượng Khối Xét nghiệm - BVĐK Đức Giang'
            issuer = 'BVĐK Đức Giang'
            year = 2024

        elif 'bổ nhiệm phụ trách ksnk' in fn.lower() or '302' in fn:
            code = '302/QĐ-BVĐKĐG'
            title = 'Quyết định 302/QĐ-BVĐKĐG: Về việc bổ nhiệm phụ trách Khoa Kiểm soát nhiễm khuẩn - BVĐK Đức Giang'
            issuer = 'BVĐK Đức Giang'
            year = 2024

        elif 'bổ nhiệm 1568' in fn.lower():
            code = '1568/QĐ-SYT'
            title = 'Quyết định 1568/QĐ-SYT: Về công tác cán bộ và kiện toàn nhân sự lãnh đạo y tế của Sở Y tế Hà Nội'
            issuer = 'Sở Y tế Hà Nội'
            year = 2023

        elif '2015 vv tuân thủ quy trình nhận dạng nb' in fn.lower():
            code = '2015/CV-BVĐKĐG'
            title = 'Công văn 2015/CV-BVĐKĐG: Tuân thủ quy trình nhận dạng người bệnh và quy trình giao nhận mẫu xét nghiệm'
            issuer = 'BVĐK Đức Giang'
            year = 2023

        elif 'báo cáo giải pháp cấy dương tính' in fn.lower():
            code = 'BC-VS-CDT'
            title = 'Báo cáo thực trạng và các giải pháp nâng cao tỷ lệ cấy dương tính bệnh phẩm vi sinh - BVĐK Đức Giang'
            issuer = 'BVĐK Đức Giang'
            year = 2021

        elif 'thành lập phòng xét nghiệm sinh học phân tử' in fn.lower() or '372' in fn:
            code = '372/QĐ-BVĐKĐG'
            title = 'Quyết định 372/QĐ-BVĐKĐG: Thành lập Đơn vị Xét nghiệm Sinh học Phân tử (PCR) tại Khoa Vi sinh'
            issuer = 'BVĐK Đức Giang'
            year = 2020

        elif 'iso-15189' in fn.lower() or 'iso 15189' in fn.lower():
            code = 'ISO 15189:2022'
            title = 'Tiêu chuẩn Quốc tế ISO 15189:2022: Phòng xét nghiệm y tế - Yêu cầu về chất lượng và năng lực chuyên môn'
            issuer = 'Tổ chức ISO / AOSC'
            year = 2022

        # Final check: if code is still a generic VBYT-
        if code.startswith('VBYT-'):
            # Attempt to extract official numbers from filename
            m_num = re.search(r'\b([0-9]{2,4}(?:/[0-9]{4})?)\b', fn)
            if 'qd' in fn.lower() or 'qđ' in fn.lower():
                num = m_num.group(1) if m_num else d_id.split('_')[-1]
                code = f'{num}/QĐ'
                title = f'Quyết định {code}: Văn bản chuyên môn y tế ({fn})'
            elif 'tt' in fn.lower():
                num = m_num.group(1) if m_num else d_id.split('_')[-1]
                code = f'{num}/TT-BYT'
                title = f'Thông tư {code}: Quy định chuyên môn y tế ({fn})'
            elif 'cv' in fn.lower() or 'công văn' in fn.lower():
                num = m_num.group(1) if m_num else d_id.split('_')[-1]
                code = f'{num}/CV-ĐG'
                title = f'Công văn {code}: Hướng dẫn công tác chuyên môn y tế ({fn})'
            else:
                code = f'VB-{d_id.split("_")[-1]}'
                clean_name = os.path.splitext(fn)[0].replace('_', ' ').replace('-', ' ')
                title = f'Văn bản y tế: {clean_name}'

        # Update the document entry
        d['code'] = code
        d['title'] = title
        d['issuer'] = issuer
        d['year'] = year

        # Regenerate rich search keywords
        kw_list = [
            code.lower(),
            remove_vn_tones(code),
            title.lower(),
            remove_vn_tones(title),
            fn.lower(),
            remove_vn_tones(fn),
            issuer.lower(),
            remove_vn_tones(issuer),
            str(year),
            d.get('formatLabel', '').lower()
        ]
        # Append topic keywords
        title_lower = title.lower()
        if 'kháng sinh' in title_lower or 'kháng thuốc' in title_lower:
            kw_list.append('kháng sinh kháng thuốc ksd giám sát vi sinh vi sinh lâm sàng clsi')
        if 'covid' in title_lower or 'sars-cov-2' in title_lower:
            kw_list.append('covid-19 dịch bệnh sars-cov-2 test nhanh pcr rt-pcr lấy mẫu tỵ hầu')
        if 'an toàn sinh học' in title_lower or 'atsh' in title_lower:
            kw_list.append('an toàn sinh học atsh cấp 2 nồi hấp rác thải lây nhiễm bảo hộ cá nhân')
        if 'iso' in title_lower or '2429' in title_lower or 'chất lượng' in title_lower:
            kw_list.append('quản lý chất lượng qlcl tiêu chí 2429 tiêu chuẩn iso 15189 nội kiểm ngoại kiểm iqc eqas')
        if 'lao' in title_lower:
            kw_list.append('bệnh lao vi khuẩn lao afb nhuộm ziehl-neelsen cấy mgit genexpert mtb rif')
        if 'viêm gan' in title_lower or 'hbv' in title_lower or 'hcv' in title_lower:
            kw_list.append('viêm gan b viêm gan c hbsag hbeag anti-hcv đo tải lượng hbv-dna hcv-rna định type')
        if 'dengue' in title_lower or 'sốt xuất huyết' in title_lower:
            kw_list.append('sốt xuất huyết dengue ns1ag kháng thể igm igg tiểu cầu rt-pcr')
        if 'nước lọc thận' in title_lower or 'thận nhân tạo' in title_lower or 'ro' in title_lower:
            kw_list.append('nước chạy thận lọc thận ro cấy vi khuẩn hiếu khí nội độc tố endotoxin tai biến lọc máu')
        if 'giá' in title_lower or 'bhyt' in title_lower:
            kw_list.append('giá dịch vụ bảo hiểm y tế bhyt thanh toán khung giá định mức chi phí')
        if 'đấu thầu' in title_lower or 'thiết bị' in title_lower:
            kw_list.append('mua sắm đấu thầu trang thiết bị hóa chất vật tư sinh phẩm xét nghiệm')

        d['keywords'] = ' '.join(set(' '.join(kw_list).split()))

    # Build updated JS file
    output_js = """/**
 * Danh Mục Văn Bản Y Tế - Khoa Vi Sinh BVĐK Đức Giang
 * Tổng số văn bản: 295 văn bản đã được chuẩn hóa số hiệu & tên nội dung
 * Đồng bộ: Supabase Storage Bucket ('tai-lieu/Van_Ban_Y_Te')
 */

const MEDICAL_DOCUMENTS_DATA = """ + json.dumps(docs, ensure_ascii=False, indent=2) + """;

const MEDICAL_DOC_CATEGORIES = [
  { "id": "all", "label": "Tất cả văn bản", "icon": "📚" },
  { "id": "Chuyen_Mon_Vi_Sinh", "label": "Chuyên môn Vi sinh & Kỹ thuật", "icon": "🧫" },
  { "id": "Quan_Ly_Chat_Luong_ISO", "label": "Quản lý chất lượng & ISO 15189", "icon": "📋" },
  { "id": "An_Toan_Sinh_Hoc", "label": "An toàn sinh học & Môi trường", "icon": "☣️" },
  { "id": "Phac_Do_Dieu_Tri", "label": "Phác đồ điều trị & Chẩn đoán", "icon": "🩺" },
  { "id": "Van_Ban_Phap_Quy", "label": "Pháp quy, Luật & Thông tư", "icon": "⚖️" },
  { "id": "Benh_Vien_Va_So_Y_Te", "label": "Văn bản BV Đức Giang & SYT", "icon": "🏥" },
  { "id": "Phong_Chong_Dich_Covid", "label": "Phòng chống dịch & Covid-19", "icon": "🛡️" }
];
"""

    with open('js/medical-documents-data.js', 'w', encoding='utf-8') as f:
        f.write(output_js)

    print("✅ Đã cập nhật thành công js/medical-documents-data.js với số hiệu và tên nội dung chuẩn xác!")

if __name__ == '__main__':
    main()
