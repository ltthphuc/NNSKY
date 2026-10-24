# Sky – Phần mềm quản lý trung tâm ngoại ngữ

Web app thuần HTML/CSS/JS (không cần cài đặt hay build), lưu dữ liệu bằng **Firebase**, đưa lên **GitHub Pages** để chạy online.

## Chức năng
- **Quản trị viên**: tạo lớp (mã lớp riêng, học kỳ/năm học, lịch học, học phí lớp), tạo tài khoản giáo viên, xem toàn bộ học sinh, học phí, cài đặt quy tắc trừ tiền.
- **Giáo viên** (tối đa tùy ý): chỉ thấy lớp được phân công; nhập danh sách học sinh, điểm danh theo lịch lớp, nhập điểm/nhận xét, xem học phí.
- Điểm danh nhanh: chọn buổi theo lịch, mặc định có mặt, bỏ tick em vắng, có nút "Có mặt tất cả / Vắng tất cả".
- Học phí tự tính: học phí lớp − (số buổi vắng × tiền trừ) nếu vắng từ N buổi trở lên (mặc định từ 2 buổi, 50.000đ/buổi, sửa ở Cài đặt).
- Mỗi lớp có **giáo viên chính + trợ giảng**; cả hai đều thấy và điểm danh lớp đó.
- **Điểm danh giáo viên** theo ngày (ngay trong màn hình Điểm danh): tick có dạy, nhập số tiết. **Công & lương GV**: tiền = số tiết × đơn giá tiết (đơn giá riêng cho vai trò chính / trợ giảng, nhập ở mục Giáo viên), thống kê theo tháng, đánh dấu đã trả, xuất Excel.
- **Hai cách tính học phí học sinh** (chọn theo từng lớp, đổi nhanh ở màn hình Điểm danh bằng tài khoản quản trị): (1) theo số buổi nghỉ: trừ tiền khi vắng; (2) theo số buổi đã đi học: số buổi có mặt × đơn giá buổi, **tối đa bằng học phí tháng của lớp** (đi đủ thì không tính thêm).
- Menu **Lớp học** gồm các mục con: Danh sách lớp, Điểm danh, Đánh giá & điểm, Học phí. **Danh sách học sinh nằm trong từng lớp**: bấm tên lớp để xem, thêm, sửa, nhập Excel, xuất báo cáo.
- **Điểm danh theo lớp**: vào Lớp học → chọn lớp → tab **Điểm danh** để điểm danh học sinh và giáo viên (dạy đủ / nghỉ cả buổi / nghỉ một số tiết) theo từng ngày. Mục **Công & lương GV** chỉ tổng hợp từ dữ liệu đó, có danh sách các buổi giáo viên nghỉ và tiền bị trừ.
- Mục **Giáo viên** (chỉ quản trị viên, nằm trong phần Quản trị): bấm tên giáo viên để phân công vào các lớp đã có (dạy chính / trợ giảng) và **điểm danh nhanh** theo tháng, tuần hoặc ngày: mỗi lớp hiện các ngày đã học, ô xanh = lên lớp, ô trắng = nghỉ; chọn / bỏ cả ngày, cả lớp hoặc từng ngày. **Công & lương GV** cũng nằm trong phần Quản trị.
- Trang của mỗi lớp có tab **Điểm danh**: xem các buổi đã học **từ khi mở lớp đến hôm nay**, theo tháng hoặc theo tuần, và nút **Điểm danh bù nhiều ngày** (cho tất cả học sinh có mặt đủ nhiều buổi cùng lúc, có thể chỉ điền các buổi chưa điểm danh).
- Tab **Phiếu hoàn thành khóa học** của lớp: chọn học sinh đã hoàn thành, **in phiếu từng học sinh** (A4 dọc) và **in bảng tổng hợp lớp** (A4 ngang (trái - phải)) gồm tổng số học sinh hoàn thành, điểm và nhận xét của các bài kiểm tra; có cả xuất Excel.
- Trang **Danh sách lớp** có nút **In phiếu hoàn thành hàng loạt**: chọn nhiều lớp, in phiếu của mọi học sinh từng lớp (lớp nào xếp liền lớp đó) và bảng tổng hợp mỗi lớp một trang; có cả xuất Excel.
- **Phiếu hoàn thành song ngữ Anh - Việt** (in và Excel): tiêu đề, nhãn, tên cột, chữ ký đều có cả hai ngôn ngữ; tên trung tâm tiếng Anh đặt ở Cài đặt. Bản Excel gom mọi học sinh vào **1 sheet, mỗi tờ A4 có 2 phiếu**.
- Mỗi học sinh có **ngày bắt đầu học**: vào lớp giữa chừng thì điểm danh và học phí chỉ tính từ ngày đó (học phí cố định được tính theo tỷ lệ số buổi có theo học).
- **Báo cáo học sinh** (Excel): tải riêng từng học sinh, các em đã chọn hoặc cả lớp; bật/tắt từng mục (thông tin, điểm từng bài, số buổi đi học, học phí tháng...). Lựa chọn được nhớ cho lần sau.
- Trong **Xuất báo cáo** có 3 kiểu: bảng tổng hợp, **bảng kết quả học tập từng học sinh** (xếp dọc, chọn bài kiểm tra nào hiển thị) và **giấy chứng nhận hoàn thành khóa học** (mỗi học sinh một sheet, in A4).
- **Nhập từ Excel** ở mọi nơi: danh sách học sinh, điểm danh học sinh (bảng ✓ / V), điểm một bài hoặc nhiều bài kiểm tra, trạng thái đóng học phí, chấm công giáo viên. Mỗi màn hình có nút tải file mẫu.
- Excel: nhập danh sách học sinh, nhập điểm, tải file mẫu, xuất danh sách / điểm danh tháng / điểm / học phí. In phiếu thu.

## Chạy thử (không cần Firebase)
Mở file `index.html` bằng Chrome/Edge. Hệ thống ở **chế độ dùng thử** với dữ liệu mẫu lưu trên trình duyệt.
Tài khoản mẫu: `admin@sky.vn / admin123`, giáo viên `gv1@sky.vn`, `gv2@sky.vn`, `gv3@sky.vn` (mật khẩu `123456`).

## Kết nối Firebase (chạy online)
1. Vào https://console.firebase.google.com → **Add project** (tắt Google Analytics cũng được).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (chọn vị trí `asia-southeast1`, chế độ Production).
4. Tab **Rules** của Firestore: dán toàn bộ nội dung file `firestore.rules` rồi **Publish**.
5. **Project settings (biểu tượng bánh răng) → Your apps → Web (`</>`)** → đặt tên, đăng ký → copy đoạn `firebaseConfig`.
6. Mở `js/config.js`, dán các giá trị vào mục `firebase: { ... }`.
7. **Tạo tài khoản quản trị viên đầu tiên**:
   - Authentication → Users → **Add user** (email + mật khẩu của bạn).
   - Copy **User UID** của tài khoản vừa tạo.
   - Firestore → **Start collection** `users` → Document ID = UID vừa copy, thêm các trường:
     `name` (string, ví dụ "Quản trị Sky"), `email` (string), `role` (string) = `admin`, `active` (boolean) = `true`.
8. Mở web, đăng nhập bằng tài khoản trên. Vào **Giáo viên** để tạo tài khoản cho giáo viên, vào **Lớp học** để tạo lớp.

## Đưa lên GitHub Pages
1. Tạo repository mới trên GitHub (nên để **Private** nếu gói của bạn cho phép Pages với repo private, hoặc Public – dữ liệu học sinh nằm ở Firebase nên không lộ qua mã nguồn).
2. Upload toàn bộ thư mục này lên repository.
3. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
4. Sau 1–2 phút web chạy tại `https://<tên-github>.github.io/<tên-repo>/`.
5. Quan trọng: Firebase → **Authentication → Settings → Authorized domains → Add domain** → `<tên-github>.github.io`.

## Lưu ý bảo mật
- `apiKey` trong cấu hình Firebase là thông tin công khai theo thiết kế; dữ liệu được bảo vệ bởi **đăng nhập + Firestore Rules**. Tuyệt đối không bỏ bước dán Rules.
- Không đưa file Excel danh sách học sinh thật hoặc file sao lưu JSON lên repository.
- Hệ thống không cho đăng ký tự do: chỉ tài khoản do quản trị viên tạo mới vào được.
- CCCD được ẩn bớt khi hiển thị cho giáo viên; chỉ quản trị viên xem đầy đủ.

## Cấu trúc
```
index.html          giao diện chính
css/style.css       kiểu dáng
js/config.js        cấu hình Firebase
js/util.js          tiện ích, tính học phí
js/db.js            lớp dữ liệu (dùng thử + Firebase)
js/excel.js         nhập/xuất Excel, file mẫu
js/views.js         Tổng quan, Lớp học, Học sinh
js/views2.js        Điểm danh, Đánh giá, Học phí, Giáo viên, Cài đặt
js/app.js           đăng nhập, menu, điều hướng
firestore.rules     quy tắc bảo mật Firestore
```


## Báo cáo theo kỳ, mã lớp và mục "Báo cáo & hồ sơ"
- **Xuất báo cáo trong lớp** và **xuất học phí**: chọn kỳ theo tháng, học kỳ (HK1, HK2, cả năm học), khoảng ngày từ…đến… hoặc tất cả các buổi đã dạy; bật/tắt ghi tên lớp và mã lớp.
- **Quản trị → Báo cáo & hồ sơ**: nhập thông tin pháp lý của trung tâm, chọn lớp rồi
  - in/tải Word **Quyết định mở lớp** (thể thức Nghị định 30/2020/NĐ-CP; chọn một hoặc nhiều lớp, có thời khóa biểu và giáo viên phân công);
  - in/tải Word **Báo cáo tình hình hoạt động gửi Sở GD&ĐT** (tự điền số liệu);
  - tải **bộ hồ sơ Excel phục vụ kiểm tra** (tổng hợp, danh sách học sinh/giáo viên, thời khóa biểu, điểm danh, kết quả học tập, học phí, rà soát dữ liệu thiếu, danh mục hồ sơ cần chuẩn bị).
- Các văn bản pháp luật trong phần "căn cứ" chỉ là gợi ý, hãy đối chiếu quy định hiện hành của địa phương trước khi ban hành.

## Bài đánh giá có cột phụ
Khi tạo bài đánh giá có thể chọn "Một điểm duy nhất" hoặc "Nhiều thành phần" (Nghe, Nói, Đọc, Viết, Từ vựng, Ngữ pháp hoặc cột tự thêm). Điểm chung tự tính bằng trung bình các cột hoặc tự nhập. Chọn riêng cho từng bài, sửa được trong trang nhập điểm (nút Thành phần điểm); file mẫu và file xuất Excel có thêm các cột phụ.
