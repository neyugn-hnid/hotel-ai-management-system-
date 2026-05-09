using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hotel_Manager.Modal
{
    [Table("bookings")]
    public class Booking
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("booking_code")]
        public string BookingCode { get; set; } = null!;

        [Column("customer_id")]
        public int CustomerId { get; set; }

        [ForeignKey(nameof(CustomerId))]
        public virtual Customer Customer { get; set; } = null!;

        [Column("room_id")]
        public int RoomId { get; set; }

        [ForeignKey(nameof(RoomId))]
        public virtual Room Room { get; set; } = null!;

        [Column("account_id")]
        public int? AccountId { get; set; }

        [ForeignKey(nameof(AccountId))]
        public virtual Account? Account { get; set; }

        [Column("check_in_date")]
        public DateTime CheckInDate { get; set; }

        [Column("check_out_date")]
        public DateTime CheckOutDate { get; set; }

        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = "Chờ xác nhận";

        [Column("ai_match_score", TypeName = "decimal(5,2)")]
        public decimal? AiMatchScore { get; set; }

        [Column("total_room_amount", TypeName = "decimal(15,2)")]
        public decimal TotalRoomAmount { get; set; }

        [Column("notes")]
        public string? Notes { get; set; }

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

        
        public virtual ICollection<BookingService> BookingServices { get; set; } = new List<BookingService>();
        public virtual Invoice? Invoice { get; set; }
        
        public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    }

}
