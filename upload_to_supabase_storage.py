#!/usr/bin/env python3
"""
Script tải toàn bộ 114 file tài liệu lên Supabase Storage Bucket 'tai-lieu'
Khoa Vi Sinh - BVĐK Đức Giang
"""

import os, sys, urllib.request, urllib.parse, mimetypes, time

SUPABASE_URL = "https://wbzjkwudiaeisujoimfi.supabase.co"
SUPABASE_KEY = "sb_publishable_HppbYtatmqwp1J3AdKvPkQ_txIxguvc"
BUCKET_NAME = "tai-lieu"

BASE_DIR = "Tài Liệu"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def upload_file(local_path, remote_path):
    mime_type, _ = mimetypes.guess_type(local_path)
    if not mime_type:
        mime_type = "application/pdf"
    
    with open(local_path, "rb") as f:
        file_bytes = f.read()

    encoded_remote_path = urllib.parse.quote(remote_path)
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{encoded_remote_path}"

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
    print(f"=== ĐANG KIỂM TRA BUCKET '{BUCKET_NAME}' TRÊN SUPABASE ===")
    check_url = f"{SUPABASE_URL}/storage/v1/bucket/{BUCKET_NAME}"
    req = urllib.request.Request(check_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"✅ Bucket '{BUCKET_NAME}' đã tồn tại và sẵn sàng!")
    except urllib.error.HTTPError as e:
        print(f"⚠️ Chưa tìm thấy bucket '{BUCKET_NAME}' (Mã lỗi: {e.code}).")
        print(f"👉 Vui lòng tạo bucket '{BUCKET_NAME}' và bật chế độ 'Public bucket' trên Supabase Dashboard trước khi chạy upload.")
        sys.exit(1)

    all_files = []
    for root, dirs, files in os.walk(BASE_DIR):
        for f in files:
            if not f.startswith("."):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, BASE_DIR)
                all_files.append((full_path, rel_path, f, os.path.getsize(full_path)))

    print(f"\n=== BẮT ĐẦU TẢI {len(all_files)} TÀI LIỆU LÊN SUPABASE STORAGE ===")
    success_count = 0
    fail_count = 0

    for i, (full_p, rel_p, fname, size) in enumerate(all_files, 1):
        size_mb = size / (1024 * 1024)
        print(f"[{i}/{len(all_files)}] Đang tải: {rel_p} ({size_mb:.2f} MB)... ", end="", flush=True)
        ok, code, err = upload_file(full_p, rel_p)
        if ok:
            print("✅ Thành công")
            success_count += 1
        else:
            print(f"❌ Thất bại ({code}): {err}")
            fail_count += 1
        time.sleep(0.1)

    print(f"\n=== KẾT QUẢ TẢI LÊN ===")
    print(f"- Thành công: {success_count}/{len(all_files)}")
    print(f"- Thất bại: {fail_count}/{len(all_files)}")
    if success_count > 0:
        print(f"👉 Đường dẫn tài liệu trên Supabase Storage:")
        print(f"   {SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/<Tên_Nhóm>/<Tên_File>")

if __name__ == "__main__":
    main()
