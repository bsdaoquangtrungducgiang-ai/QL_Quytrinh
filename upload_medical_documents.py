#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script tải toàn bộ 295 tài liệu Văn Bản Y Tế lên Supabase Storage
Khoa Vi Sinh - BVĐK Đức Giang
Bucket: 'tai-lieu' -> Thư mục: 'Van_Ban_Y_Te/'
"""

import os, sys, json, mimetypes, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

SUPABASE_URL = "https://wbzjkwudiaeisujoimfi.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "sb_publishable_HppbYtatmqwp1J3AdKvPkQ_txIxguvc")
BUCKET_NAME = "tai-lieu"
MAX_WORKERS = 4 # safe concurrent uploads

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

def upload_single_file(doc):
    local_path = doc['localPath']
    storage_key = doc['storageKey']
    size = doc['size']
    
    # Supabase free tier object size limit is 50MB
    if size > 50 * 1024 * 1024:
        return {
            'id': doc['id'],
            'title': doc['title'],
            'status': 'SKIPPED_OVER_50MB',
            'code': 413,
            'message': f'Dung lượng ({doc["sizeFormatted"]}) vượt quá giới hạn 50MB/file của Supabase Free Tier'
        }
        
    mime_type, _ = mimetypes.guess_type(local_path)
    if not mime_type:
        ext = os.path.splitext(local_path)[1].lower()
        if ext in ['.doc', '.docx']:
            mime_type = "application/msword"
        elif ext in ['.xls', '.xlsx']:
            mime_type = "application/vnd.ms-excel"
        else:
            mime_type = "application/pdf"

    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{storage_key}"
    
    req_headers = dict(headers)
    req_headers["Content-Type"] = mime_type
    req_headers["x-upsert"] = "true"

    try:
        with open(local_path, "rb") as f:
            file_bytes = f.read()

        req = urllib.request.Request(url, data=file_bytes, headers=req_headers, method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            return {
                'id': doc['id'],
                'title': doc['title'],
                'status': 'SUCCESS',
                'code': resp.status,
                'message': 'OK'
            }
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        return {
            'id': doc['id'],
            'title': doc['title'],
            'status': 'FAILED',
            'code': e.code,
            'message': err_msg[:200]
        }
    except Exception as e:
        return {
            'id': doc['id'],
            'title': doc['title'],
            'status': 'FAILED',
            'code': 0,
            'message': str(e)[:200]
        }

def main():
    manifest_file = os.path.join(os.path.dirname(__file__), 'medical_upload_manifest.json')
    if not os.path.exists(manifest_file):
        print("❌ Không tìm thấy medical_upload_manifest.json. Hãy chạy build_medical_catalog.py trước.")
        return

    with open(manifest_file, 'r', encoding='utf-8') as f:
        docs = json.load(f)

    total = len(docs)
    total_bytes = sum(d['size'] for d in docs)
    print("=" * 70)
    print("🚀 BỘ TẢI VĂN BẢN Y TẾ LÊN SUPABASE STORAGE")
    print(f"👉 Điểm đến: {SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/Van_Ban_Y_Te")
    print(f"👉 Tổng số tệp: {total} văn bản ({total_bytes / (1024*1024):.2f} MB)")
    print(f"👉 Số luồng song song: {MAX_WORKERS}")
    print("=" * 70)

    # Test bucket accessibility
    test_url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET_NAME}"
    req = urllib.request.Request(
        test_url,
        data=b'{"prefix":"","limit":1}',
        headers={**headers, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print("✅ Kết nối Supabase Storage thành công! Bắt đầu tải lên...\n")
    except Exception as e:
        print(f"❌ Lỗi kết nối bucket: {e}")
        return

    success_cnt = 0
    fail_cnt = 0
    skipped_cnt = 0
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_doc = {executor.submit(upload_single_file, doc): doc for doc in docs}
        
        for idx, future in enumerate(as_completed(future_to_doc), start=1):
            res = future.result()
            status = res['status']
            if status == 'SUCCESS':
                success_cnt += 1
                icon = "✅"
            elif status == 'SKIPPED_OVER_50MB':
                skipped_cnt += 1
                icon = "⚠️"
            else:
                fail_cnt += 1
                icon = "❌"

            elapsed = time.time() - start_time
            rate = idx / elapsed if elapsed > 0 else 0
            percent = (idx / total) * 100
            print(f"[{idx:3d}/{total}] ({percent:5.1f}%) {icon} {res['title'][:45]:<45} | {status} ({res['code']}) | {rate:.1f} tệp/s")

    print("\n" + "=" * 70)
    print(f"🏁 KẾT QUẢ TẢI LÊN:")
    print(f"  • Thành công:  {success_cnt} / {total} tệp")
    if skipped_cnt > 0:
        print(f"  • Bỏ qua (>50MB): {skipped_cnt} tệp")
    if fail_cnt > 0:
        print(f"  • Thất bại:   {fail_cnt} tệp")
    print(f"  • Tổng thời gian: {time.time() - start_time:.2f} giây")
    print("=" * 70)

if __name__ == '__main__':
    main()
