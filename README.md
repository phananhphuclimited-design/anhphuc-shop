# ANHPHUC SHOP

Website cửa hàng sản phẩm số, giao diện tiếng Việt, ưu tiên điện thoại Android.

## Có sẵn
- Trang chủ hiển thị sản phẩm do ADMIN tự thêm, không khóa cứng danh mục.
- ADMIN đăng nhập; thêm/sửa/xóa/ẩn sản phẩm; tải ảnh và tệp số lên.
- Quản lý đơn hàng và trạng thái: Chờ xác nhận, Đã thanh toán, Đã giao file, Đã hủy.
- Cấu hình tên shop, thông tin ngân hàng và hướng dẫn chuyển khoản.
- Tệp tải xuống chỉ được phục vụ sau khi đơn được ADMIN xác nhận thanh toán.
- SQLite lưu sản phẩm, đơn hàng, tài khoản quản trị và phiên đăng nhập.

## Chạy thử trên máy tính
Cần cài Node.js 20 trở lên.

1. Giải nén thư mục.
2. Sao chép `.env.example` thành `.env`.
3. Đổi `SESSION_SECRET` thành chuỗi ngẫu nhiên dài; đổi `ADMIN_PASSWORD` thành mật khẩu mạnh (ít nhất 12 ký tự). Không dùng mật khẩu mẫu.
4. Mở terminal tại thư mục dự án và chạy:
   `npm install`
   `npm start`
5. Mở `http://localhost:3000`; trang quản trị ở `http://localhost:3000/admin.html`.

## Đưa lên Internet
Triển khai trên máy chủ Node.js có ổ đĩa lưu trữ bền vững. Thiết lập các biến môi trường trong bảng điều khiển hosting thay vì tải file `.env` lên nơi công khai. Bật HTTPS và sao lưu thư mục `data/` cùng `uploads/` định kỳ. Không dùng hosting chỉ lưu file tạm vì dữ liệu SQLite và file tải lên có thể mất khi máy chủ khởi động lại.

## Thanh toán thủ công
Khách tạo đơn -> website hiển thị mã đơn và số tiền -> khách chuyển khoản theo thông tin ADMIN cấu hình -> ADMIN kiểm tra giao dịch trong tài khoản ngân hàng -> đổi trạng thái đơn sang “Đã thanh toán” -> mới cho phép tải tệp. Website không tự xác minh giao dịch ngân hàng.

## Lưu ý bảo mật
- Đổi mật khẩu ADMIN ngay sau khi cài.
- Không chia sẻ tài khoản quản trị.
- Giới hạn tải lên 50MB mỗi tệp; chỉ cho phép một số định dạng phổ biến.
- Dùng HTTPS khi chạy thật. Nên đặt reverse proxy, giới hạn tần suất đăng nhập và sao lưu thường xuyên trước khi mở bán.
- Chỉ đăng bán nội dung mà bạn có quyền phân phối và tuân thủ quy định của nền tảng/game liên quan.
