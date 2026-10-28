#!/usr/bin/env python3
"""
Script tải toàn bộ 114 file tài liệu số hóa lên Supabase Storage Bucket 'tai-lieu'
Khoa Vi Sinh - BVĐK Đức Giang
Phiên bản: Chuẩn hóa ASCII Key theo chuẩn AWS S3 / Supabase Storage
"""

import os, sys, json, re, urllib.request, urllib.parse, mimetypes, time, unicodedata

SUPABASE_URL = "https://wbzjkwudiaeisujoimfi.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "sb_publishable_HppbYtatmqwp1J3AdKvPkQ_txIxguvc")
BUCKET_NAME = "tai-lieu"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def to_safe_key(text):
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(c for c in text if not unicodedata.combining(c))
    text = text.replace('đ', 'd').replace('Đ', 'D')
    text = re.sub(r'[^a-zA-Z0-9._/-]', '_', text)
    text = re.sub(r'_+', '_', text)
    return text.strip('_')

def load_procedures_catalog():
    data_file = os.path.join(os.path.dirname(__file__), 'js', 'data.js')
    if not os.path.exists(data_file):
        print(f"❌ Không tìm thấy tệp {data_file}")
        sys.exit(1)
        
    with open(data_file, 'r', encoding='utf-8') as f:
        text = f.read()
    m = re.search(r'const PROCEDURES_DATA = (\[.*?\]);', text, re.DOTALL)
    if not m:
        print("❌ Không parse được PROCEDURES_DATA từ js/data.js")
        sys.exit(1)
    return json.loads(m.group(1))

def upload_file(local_path, remote_path):
    mime_type, _ = mimetypes.guess_type(local_path)
    if not mime_type:
        mime_type = "application/pdf"
    
    with open(local_path, "rb") as f:
        file_bytes = f.read()

    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{remote_path}"

    req_headers = dict(headers)
    req_headers["Content-Type"] = mime_type
    req_headers["x-upsert"] = "true"

    req = urllib.request.Request(url, data=file_bytes, headers=req_headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return True, resp.status, ""
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        return False, e.code, err_msg
    except Exception as e:
        return False, 0, str(e)

def main():
    print("=" * 70)
    print("🚀 BỘ TẢI TÀI LIỆU LÊN SUPABASE STORAGE - KHOA VI SINH BV ĐỨC GIANG")
    print(f"👉 Project: {SUPABASE_URL}")
    print(f"👉 Bucket:  {BUCKET_NAME}")
    print("=" * 70)

    # 1. Kiểm tra kết nối tới Bucket
    check_url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET_NAME}"
    req = urllib.request.Request(
        check_url,
        data=b'{"prefix":"","limit":1}',
        headers={**headers, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"✅ Kết nối thành công! Bucket '{BUCKET_NAME}' đã tồn tại và sẵn sàng.\n")
    except urllib.error.HTTPError as e:
        print(f"⚠️ Lỗi kết nối bucket '{BUCKET_NAME}' (HTTP {e.code}): {e.read().decode()}")
        sys.exit(1)

    procedures = load_procedures_catalog()
    total = len(procedures)
    print(f"📋 Đã nạp danh mục {total} quy trình từ js/data.js.")

    success_count = 0
    fail_count = 0
    rls_error_detected = False

    for i, p in enumerate(procedures, 1):
        local_p = p['path']
        # macOS decomposed path fallback
        if not os.path.exists(local_p):
            local_p_nfc = unicodedata.normalize('NFC', local_p)
            local_p_nfd = unicodedata.normalize('NFD', local_p)
            if os.path.exists(local_p_nfc):
                local_p = local_p_nfc
            elif os.path.exists(local_p_nfd):
                local_p = local_p_nfd

        remote_key = p.get('storageKey')
        if not remote_key:
            remote_key = f"{to_safe_key(p['category'])}/{to_safe_key(p['filename'])}"

        size_mb = os.path.getsize(local_p) / (1024 * 1024)
        print(f"[{i}/{total}] Đang tải: {remote_key} ({size_mb:.2f} MB)... ", end="", flush=True)

        ok, code, err = upload_file(local_p, remote_key)
        if ok:
            print("✅ Thành công")
            success_count += 1
        else:
            print(f"❌ Thất bại ({code}): {err}")
            fail_count += 1
            if ("row-level security policy" in err or "AccessDenied" in err or code == 403) and not rls_error_detected:
                rls_error_detected = True
                print("\n" + "=" * 70)
                print("🔒 PHÁT HIỆN: SUPABASE RLS POLICY ĐANG CHẶN QUYỀN TẢI LÊN!")
                print("=" * 70)
                print("Lý do: Bucket 'tai-lieu' hiện có 0 Policy, mặc định Supabase chỉ cho phép đọc.")
                print("Để tải file lên thành công và cho phép người dùng tải tài liệu mới từ web:")
                print("\n👉 CÁCH THỰC HIỆN ĐƠN GIẢN NHẤT (Chỉ mất 15 giây):")
                print("  1. Mở trang SQL Editor của Supabase:")
                print("     https://supabase.com/dashboard/project/wbzjkwudiaeisujoimfi/sql/new")
                print("  2. Dán đoạn mã SQL sau và bấm nút 'Run' (Cmd + Enter):")
                print("\n" + "-" * 50)
                print("CREATE POLICY \"Allow public access tai-lieu\"")
                print("ON storage.objects FOR ALL")
                print("USING ( bucket_id = 'tai-lieu' )")
                print("WITH CHECK ( bucket_id = 'tai-lieu' );")
                print("-" * 50 + "\n")
                print("  3. Sau đó chạy lại: python3 upload_to_supabase_storage.py")
                print("=" * 70 + "\n")
                sys.exit(1)

        time.sleep(0.05)

    print("\n" + "=" * 70)
    print("🏁 HOÀN TẤT QUÁ TRÌNH TẢI TÀI LIỆU")
    print(f"✅ Thành công: {success_count}/{total}")
    print(f"❌ Thất bại:   {fail_count}/{total}")
    if success_count > 0:
        print(f"\n🌐 Đường dẫn tra cứu tài liệu trực tiếp từ Supabase Storage:")
        print(f"   {SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/<Nhóm>/<Tên_File>")
    print("=" * 70)

if __name__ == "__main__":
    main()
