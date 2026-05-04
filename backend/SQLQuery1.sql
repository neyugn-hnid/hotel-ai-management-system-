INSERT INTO room_images (room_id, image_url, created_at) VALUES
(4, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',GETUTCDATE()),

(5, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',GETUTCDATE()),

(6, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',GETUTCDATE()),

(7, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),

(8, 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',GETUTCDATE()),

(9, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',GETUTCDATE()),

(10, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),

(11, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE()),

(12, 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',GETUTCDATE()),

(13, 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',GETUTCDATE()),

(14, 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',GETUTCDATE()),

(15, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE());

INSERT INTO rooms 
( name, room_type, price_per_night, status, description, created_at, updated_at)
VALUES
('Standard Classic', 'Standard', 3500000, N'Trống', N'Sự thoải mái trang nhã với tầm nhìn ra quang cảnh thành phố và bộ khăn trải giường cao cấp.', GETUTCDATE(), GETUTCDATE()),

('Deluxe Garden', 'Deluxe', 6500000, N'Trống', N'Không gian rộng rãi với ban công riêng nhìn ra vườn bách thảo.', GETUTCDATE(), GETUTCDATE()),

('Executive Suite', 'Suite', 12500000, N'Trống', N'Khu vực tiếp khách riêng biệt với cửa sổ kính suốt từ trần đến sàn và phòng tắm lát đá cẩm thạch.', GETUTCDATE(), GETUTCDATE()),

('Penthouse Sky', 'Penthouse', 27500000, N'Trống', N'Đỉnh cao của sự sang trọng với hồ bơi riêng và tầm nhìn toàn cảnh đường chân trời.', GETUTCDATE(), GETUTCDATE()),

('Deluxe Ocean', 'Deluxe', 7500000, N'Trống', N'Tầm nhìn ngoạn mục ra đường bờ biển với tính thẩm mỹ hàng hải đương đại.', GETUTCDATE(), GETUTCDATE()),

('Family Grand Suite', 'Suite', 15000000, N'Trống', N'Cấu hình nhiều phòng lý tưởng cho các gia đình tìm kiếm sự sang trọng và riêng tư.', GETUTCDATE(), GETUTCDATE()),

('Standard City View', 'Standard', 3600000, N'Trống', N'Phòng tiêu chuẩn với thiết kế hiện đại, ngắm nhìn nhịp sống sôi động của thành phố.', GETUTCDATE(), GETUTCDATE()),

('Premium Deluxe', 'Deluxe', 8000000, N'Trống', N'Nội thất cao cấp, không gian mở với ánh sáng tự nhiên và bồn tắm thư giãn.', GETUTCDATE(), GETUTCDATE()),

('Royal Suite', 'Suite', 19000000, N'Trống', N'Trải nghiệm hoàng gia với dịch vụ quản gia riêng và phòng ăn sang trọng.', GETUTCDATE(), GETUTCDATE()),

('Cozy Standard', 'Standard', 3200000, N'Trống', N'Không gian ấm cúng, yên tĩnh, hoàn hảo cho những chuyến công tác ngắn ngày.', GETUTCDATE(), GETUTCDATE()),

('Oceanfront Penthouse', 'Penthouse', 35000000, N'Trống', N'Biệt thự trên không với view biển 360 độ, hồ bơi vô cực và rạp chiếu phim mini.', GETUTCDATE(), GETUTCDATE()),

('Deluxe Corner', 'Deluxe', 7000000, N'Trống', N'Phòng góc với hai mặt kính, mang lại tầm nhìn thoáng đãng và không gian ngập tràn ánh sáng.', GETUTCDATE(), GETUTCDATE());


INSERT INTO customers 
(full_name, email, phone_number, identity_card, status, ai_preferences, created_at, updated_at)
VALUES
(N'Nguyễn Văn An', 'an.nguyen@gmail.com', '0901234567', '123456789', N'Đang lưu trú', N'Thích phòng yên tĩnh, view đẹp', GETUTCDATE(), GETUTCDATE()),

(N'Trần Thị Bình', 'binh.tran@gmail.com', '0912345678', '223456789', N'Đang lưu trú', N'Ưu tiên giá rẻ', GETUTCDATE(), GETUTCDATE()),

(N'Lê Văn Cường', 'cuong.le@gmail.com', '0923456789', '323456789', N'Đang lưu trú', N'Thích phòng cao cấp', GETUTCDATE(), GETUTCDATE()),

(N'Phạm Thị Dung', 'dung.pham@gmail.com', '0934567890', '423456789', N'Đang lưu trú', N'Cần phòng gia đình', GETUTCDATE(), GETUTCDATE()),

(N'Hoàng Văn Đức', 'duc.hoang@gmail.com', '0945678901', '523456789', N'Đang lưu trú', N'Thích view biển', GETUTCDATE(), GETUTCDATE()),

(N'Vũ Thị Hạnh', 'hanh.vu@gmail.com', '0956789012', '623456789', N'Đang lưu trú', N'Yêu cầu dịch vụ cao cấp', GETUTCDATE(), GETUTCDATE()),

(N'Đặng Văn Khoa', 'khoa.dang@gmail.com', '0967890123', '723456789', N'InĐang lưu trú', N'Ưu tiên phòng gần trung tâm', GETUTCDATE(), GETUTCDATE()),

(N'Bùi Thị Lan', 'lan.bui@gmail.com', '0978901234', '823456789', N'Đang lưu trú', N'Phòng có ban công', GETUTCDATE(), GETUTCDATE()),

(N'Ngô Văn Minh', 'minh.ngo@gmail.com', '0989012345', '923456789', N'Đang lưu trú', N'Không gian yên tĩnh', GETUTCDATE(), GETUTCDATE()),

(N'Phan Thị Ngọc', 'ngoc.phan@gmail.com', '0990123456', '103456789', N'Đang lưu trú', N'Thích phòng sang trọng', GETUTCDATE(), GETUTCDATE());


INSERT INTO room_images (room_id, image_url, created_at) VALUES

-- Room 1
(4, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',GETUTCDATE()),
(4, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(4, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),

-- Room 2
(5, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',GETUTCDATE()),
(5, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',GETUTCDATE()),
(5, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),

-- Room 3
(6, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',GETUTCDATE()),
(6, 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',GETUTCDATE()),
(6, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE()),

-- Room 4
(7, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),
(7, 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',GETUTCDATE()),
(7, 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',GETUTCDATE()),

-- Room 5
(8, 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',GETUTCDATE()),
(8, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(8, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),

-- Room 6
(9, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',GETUTCDATE()),
(9, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',GETUTCDATE()),
(9, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE()),

-- Room 7
(10, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),
(10, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(10, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),

-- Room 8
(11, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE()),
(11, 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',GETUTCDATE()),
(11, 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',GETUTCDATE()),

-- Room 9
(12, 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',GETUTCDATE()),
(12, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',GETUTCDATE()),
(12, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',GETUTCDATE()),

-- Room 10
(13, 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',GETUTCDATE()),
(13, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(13, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',GETUTCDATE()),

-- Room 11
(14, 'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',GETUTCDATE()),
(14, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',GETUTCDATE()),
(14, 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',GETUTCDATE()),

-- Room 12
(15, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',GETUTCDATE()),
(15, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',GETUTCDATE()),
(15, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',GETUTCDATE());