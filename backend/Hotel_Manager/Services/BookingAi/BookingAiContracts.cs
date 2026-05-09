using System.ComponentModel.DataAnnotations;

namespace Hotel_Manager.Services.BookingAi;

public class BookingAiRecommendRequestDto
{
    [Required(ErrorMessage = "Vui long nhap thong tin khach hang de goi y phong")]
    [MinLength(2, ErrorMessage = "Thong tin khach hang phai co it nhat 2 ky tu")]
    public string CustomerQuery { get; set; } = string.Empty;

    [Range(0, double.MaxValue, ErrorMessage = "Ngan sach phai lon hon hoac bang 0")]
    public decimal? BudgetLimit { get; set; }

    [MaxLength(50)]
    public string? RoomPurpose { get; set; }

    [MaxLength(1000)]
    public string? AiPrompt { get; set; }

    [MaxLength(3000)]
    public string? BookingHistorySummary { get; set; }

    public DateTime? CheckInDate { get; set; }

    public DateTime? CheckOutDate { get; set; }

    [Range(1, 20, ErrorMessage = "So luong khach phai tu 1 den 20")]
    public int? GuestCount { get; set; }
}

public class BookingAiRecommendResultDto
{
    public string Engine { get; set; } = "rule";
    public BookingAiCustomerDto? Customer { get; set; }
    public BookingAiRecommendationDto Recommendation { get; set; } = new();
    public List<BookingAiTopRoomDto> TopRooms { get; set; } = new();
}

public class BookingAiCustomerDto
{
    public int Id { get; set; }
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? IdentityCard { get; set; }
}

public class BookingAiRecommendationDto
{
    public int RoomId { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public string? RoomType { get; set; }
    public decimal PricePerNight { get; set; }
    public string? Status { get; set; }
    public int MatchScore { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
}

public class BookingAiTopRoomDto
{
    public int RoomId { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public string? RoomType { get; set; }
    public decimal PricePerNight { get; set; }
    public int MatchScore { get; set; }
    public string? Status { get; set; }
    public string Reason { get; set; } = string.Empty;
}
