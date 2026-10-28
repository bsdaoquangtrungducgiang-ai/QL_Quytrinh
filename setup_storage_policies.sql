-- ====================================================================
-- CẤP QUYỀN TOÀN DIỆN CHO KHO LƯU TRỮ SUPABASE STORAGE 'tai-lieu'
-- Bệnh Viện Đa Khoa Đức Giang - Khoa Vi Sinh
-- ====================================================================

-- 1. Xóa các chính sách cũ (nếu có) để tránh xung đột
DROP POLICY IF EXISTS "Cho phep tai len va xem file tai-lieu" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access tai-lieu" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload tai-lieu" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon select tai-lieu" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon update tai-lieu" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon delete tai-lieu" ON storage.objects;
DROP POLICY IF EXISTS "tai_lieu_public_all" ON storage.objects;

-- 2. Cho phép Tải tệp lên (INSERT) - dành cho người dùng ẩn danh (Webapp) & đã xác thực
CREATE POLICY "Allow anon upload tai-lieu"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK ( bucket_id = 'tai-lieu' );

-- 3. Cho phép Đọc và Xem tệp (SELECT)
CREATE POLICY "Allow anon select tai-lieu"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING ( bucket_id = 'tai-lieu' );

-- 4. Cho phép Cập nhật tệp khi ghi đè / upsert (UPDATE)
CREATE POLICY "Allow anon update tai-lieu"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING ( bucket_id = 'tai-lieu' )
WITH CHECK ( bucket_id = 'tai-lieu' );

-- 5. Cho phép Xóa tệp khỏi kho (DELETE)
CREATE POLICY "Allow anon delete tai-lieu"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING ( bucket_id = 'tai-lieu' );
