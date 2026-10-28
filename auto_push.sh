#!/bin/bash
# Tự động lưu commit và đẩy code lên GitHub
# Dự án: Quản lý Quy Trình Xét Nghiệm Vi Sinh - BVĐK Đức Giang

cd "$(dirname "$0")"

echo "=== Đang kiểm tra thay đổi... ==="
git status --short

git add .

# Nếu có thay đổi thì mới commit
if ! git diff-index --quiet HEAD --; then
    COMMIT_MSG="Cập nhật tự động: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=== Đang lưu commit: $COMMIT_MSG ==="
    git commit -m "$COMMIT_MSG"
else
    echo "=== Không có thay đổi mới để commit ==="
fi

echo "=== Đang đẩy code lên GitHub (origin/main)... ==="
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Đã cập nhật thành công lên GitHub!"
else
    echo "❌ Đẩy code thất bại. Vui lòng kiểm tra lại quyền truy cập hoặc Personal Access Token."
fi
