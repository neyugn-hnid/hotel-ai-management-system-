INSERT INTO customers 
(full_name, email, phone_number, identity_card, status, ai_preferences, created_at, updated_at)
VALUES
(N'Nguyễn Văn An', 'an.nguyen@gmail.com', '0901234567', '123456789', N'Đang lưu trú', N'Thích phòng yên tĩnh, view đẹp', GETUTCDATE(), GETUTCDATE()),

(N'Trần Thị Bình', 'binh.tran@gmail.com', '0912345678', '223456789', N'Đang lưu trú', N'Ưu tiên giá rẻ', GETUTCDATE(), GETUTCDATE()),

(N'Lê Văn Cường', 'cuong.le@gmail.com', '0923456789', '323456789', N'Đang lưu trú', N'Thích phòng cao cấp', GETUTCDATE(), GETUTCDATE()),

(N'Phạm Thị Dung', 'dung.pham@gmail.com', '0934567890',GETUTCDATE(), '423456789', N'Đang lưu trú', N'Cần phòng gia đình', GETUTCDATE(), GETUTCDATE()),

(N'Hoàng Văn Đức', 'duc.hoang@gmail.com', '0945678901', '523456789', N'Đang lưu trú', N'Thích view biển', GETUTCDATE(), GETUTCDATE()),

(N'Vũ Thị Hạnh', 'hanh.vu@gmail.com', '0956789012', '623456789', N'Đang lưu trú', N'Yêu cầu dịch vụ cao cấp', GETUTCDATE(), GETUTCDATE()),

(N'Đặng Văn Khoa', 'khoa.dang@gmail.com', '0967890123', '723456789', N'InĐang lưu trú', N'Ưu tiên phòng gần trung tâm', GETUTCDATE(), GETUTCDATE()),

(N'Bùi Thị Lan', 'lan.bui@gmail.com', '0978901234', '823456789', N'Đang lưu trú', N'Phòng có ban công', GETUTCDATE(), GETUTCDATE()),

(N'Ngô Văn Minh', 'minh.ngo@gmail.com', '0989012345', '923456789', N'Đang lưu trú', N'Không gian yên tĩnh', GETUTCDATE(), GETUTCDATE()),

(N'Phan Thị Ngọc', 'ngoc.phan@gmail.com', '0990123456', '103456789', N'Đang lưu trú', N'Thích phòng sang trọng', GETUTCDATE(), GETUTCDATE());


INSERT INTO room_images (room_id, image_url, created_at) VALUES
(1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',GETUTCDATE()),

(2, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',GETUTCDATE()),

(3, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',GETUTCDATE()),

(4, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),

(5, 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',GETUTCDATE()),

(6, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',GETUTCDATE()),

(7, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),

(8, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE()),

(9, 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',GETUTCDATE()),

(10, 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',GETUTCDATE()),

(11, 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',GETUTCDATE()),

(12, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE());


INSERT INTO room_images (room_id, image_url, is_primary) VALUES


(1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',GETUTCDATE()),
(1, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(1, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),


(2, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',GETUTCDATE()),
(2, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',GETUTCDATE()),
(2, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),


(3, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',GETUTCDATE()),
(3, 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',GETUTCDATE()),
(3, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE()),


(4, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),
(4, 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',GETUTCDATE()),
(4, 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',GETUTCDATE()),


(5, 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',GETUTCDATE()),
(5, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(5, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),


(6, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',GETUTCDATE()),
(6, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',GETUTCDATE()),
(6, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE()),


(7, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),
(7, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(7, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),


(8, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE()),
(8, 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',GETUTCDATE()),
(8, 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',GETUTCDATE()),


(9, 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',GETUTCDATE()),
(9, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',GETUTCDATE()),
(9, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',GETUTCDATE()),


(10, 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',GETUTCDATE()),
(10, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(10, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),


(11, 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',GETUTCDATE()),
(11, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),
(11, 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',GETUTCDATE()),


(12, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(12, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',GETUTCDATE()),
(12, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE());