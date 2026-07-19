// Cấu hình web — sửa các giá trị này rồi nhấn Commit trên GitHub.
window.CONFIG = {
  // URL của Google Apps Script (gửi email tự động + PDF potvrzení). Xem NAVOD.md bước 5.
  appsScriptUrl: "",
  // Feed sản phẩm (XML Zboží.cz / JSON / CSV / XLSX). Feed tồn kho CPHArticleAvailabilityFeed tự ghép theo ITEM_ID.
  feedUrl: "https://voph.cz/pictures/feeds/CPHArticleFeed.xml",
  // Tự tải feed khi mở trang (khách luôn thấy dữ liệu mới)
  feedAutoDefault: true,
  // Email nhận đơn hàng
  orderEmail: "info@voph.cz",
  // Đơn tối thiểu (Kč s DPH)
  minOrder: 5000,
  // Tăng tốc ảnh: nén + resize ảnh qua CDN wsrv.nl (miễn phí). false = tải ảnh gốc trực tiếp từ voph.cz
  imgThumbs: true
};
