using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hotel_Manager.Modal
{
    [Table("booking_services")]
    public class BookingService
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("booking_id")]
        public int BookingId { get; set; }

        [ForeignKey(nameof(BookingId))]
        public virtual Booking Booking { get; set; } = null!;

        [Column("service_id")]
        public int ServiceId { get; set; }

        [ForeignKey(nameof(ServiceId))]
        public virtual Service Service { get; set; } = null!;

        [Column("quantity")]
        public int Quantity { get; set; } = 1;

        [Column("unit_price", TypeName = "decimal(15,2)")]
        public decimal UnitPrice { get; set; }

        [Column("total_price", TypeName = "decimal(15,2)")]
        public decimal TotalPrice { get; set; }

        [Column("provided_at")]
        public DateTime? ProvidedAt { get; set; } = DateTime.UtcNow;

        [Column("notes")]
        public string? Notes { get; set; }
    }

}
