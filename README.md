# Quản Lý Quy Trình Xét Nghiệm Vi Sinh (SOPs Management)
### Bệnh Viện Đa Khoa Đức Giang — Khoa Vi Sinh

Hệ thống ứng dụng webapp số hóa và tra cứu toàn bộ 114 quy trình xét nghiệm và quản lý chất lượng khối xét nghiệm theo tiêu chuẩn ISO 15189.

---

## 🌟 Tính Năng Nổi Bật

1. **Dashboard Chỉ Số & Biểu Đồ Thống Kê (Chart.js)**:
   - Thống kê trực quan 114 quy trình, 83 kỹ thuật chuyên môn Vi sinh, 31 quy trình Quản lý chất lượng.
   - Biểu đồ Doughnut phân bố 5 nhóm chuyên môn và Biểu đồ cột phân loại hình quy trình.

2. **Tra Cứu & Tìm Kiếm Thông Minh**:
   - Tìm kiếm tức thời theo tên xét nghiệm, mã SOP, loại bệnh phẩm, vi khuẩn, virus, nội kiểm, kháng sinh đồ (hỗ trợ tiếng Việt có dấu và không dấu).
   - Lọc nhanh theo 5 nhóm chuyên môn, loại hình quy trình, năm hiệu lực và sắp xếp linh hoạt.

3. **Xem Chi Tiết & Mở File PDF Gốc**:
   - Mở toàn văn tài liệu PDF gốc có đầy đủ chữ ký và dấu kiểm soát.
   - Hộp thoại tóm tắt thông tin chi tiết từng quy trình.

4. **Sổ Ghi Nhớ & Phân Công Quy Trình (Supabase Database)**:
   - Kết nối trực tiếp cơ sở dữ liệu thời gian thực Supabase (`Bs Trung Project`).
   - Quản lý nhiệm vụ rà soát, phân công nhân sự và theo dõi tiến độ thực hiện SOP.

5. **Giao Diện Hiện Đại & Thân Thiện**:
   - Tối ưu chuẩn y khoa, responsive mượt mà trên Desktop, Tablet và Mobile.
   - Hỗ trợ Chế độ Sáng / Tối (Light & Dark Mode).

---

## 📂 Cơ Cấu 5 Nhóm Chuyên Môn

- **`Quản Lý Chất Lượng` (31 quy trình)**: Quản lý trang thiết bị, nhân sự, môi trường, tài liệu, hồ sơ, rủi ro, sự không phù hợp, đánh giá nội bộ... (Mã `XN.QL`).
- **`Nuôi Cấy` (30 quy trình)**: Nuôi cấy các loại bệnh phẩm, định danh Vitek 2, kháng sinh đồ, thử nghiệm sinh hóa, vi sinh môi trường... (Mã `VS.NC`).
- **`Miễn Dịch` (28 quy trình)**: Miễn dịch tự động (HIV, HBV, HCV...), các kỹ thuật test nhanh và nội kiểm miễn dịch... (Mã `VS.MD`).
- **`Nhuộm Soi` (15 quy trình)**: Nhuộm Gram, AFB Ziehl-Neelsen, soi tươi nấm, ký sinh trùng sốt rét, giun sán... (Mã `VS.NS`).
- **`Sinh Học Phân Tử (PCR)` (10 quy trình)**: Realtime PCR SARS-CoV-2, HBV, HPV, virus hô hấp, thẩm định giá trị sử dụng và an toàn SHPT... (Mã `VS.PCR`).

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: HTML5, CSS3, JavaScript thuần (Vanilla JS - không dùng framework phức tạp).
- **Backend & Database**: [Supabase](https://supabase.com) (kết nối qua `@supabase/supabase-js` CDN).
- **Trực quan hóa**: [Chart.js](https://www.chartjs.org) CDN.

---

## 🚀 Hướng Dẫn Chạy Ứng Dụng

Chỉ cần nhấp đúp vào file `index.html` để mở trực tiếp trên trình duyệt web, hoặc triển khai miễn phí lên **GitHub Pages**.
