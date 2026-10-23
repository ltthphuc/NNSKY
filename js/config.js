/*
 * CẤU HÌNH FIREBASE
 * -----------------
 * Để trống (firebase: null) => chạy chế độ DÙNG THỬ: dữ liệu mẫu lưu ngay trên trình duyệt.
 * Khi đã tạo project Firebase, dán cấu hình vào đây (xem README.md), ví dụ:
 *
 *   firebase: {
 *     apiKey: "AIza...",
 *     authDomain: "ten-project.firebaseapp.com",
 *     projectId: "ten-project",
 *     storageBucket: "ten-project.appspot.com",
 *     messagingSenderId: "123456789",
 *     appId: "1:123456789:web:abcdef"
 *   }
 */
window.SKY_CONFIG = {
  // Thêm ?demo=1 vào địa chỉ web để mở thử chế độ dùng thử (dữ liệu mẫu trên trình duyệt, không đụng Firebase)
  firebase: /[?&]demo=1/.test(location.search) ? null : {
    apiKey: 'AIzaSyCrjx2Ipt9AA5JAm0XPxuKurCH-onZ-s4o',
    authDomain: 'nnsky-336ff.firebaseapp.com',
    projectId: 'nnsky-336ff',
    storageBucket: 'nnsky-336ff.firebasestorage.app',
    messagingSenderId: '659627464074',
    appId: '1:659627464074:web:62181805b179ff4ec56473'
  },
  centerName: 'Trung tâm ngoại ngữ Sky'
};
