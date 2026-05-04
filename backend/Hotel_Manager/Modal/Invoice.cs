using Hotel_Manager.Modal;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace Hotel_Manager.Modal;


[Table("invoices")]
public class Invoice
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    [Column("invoice_code")]
    public string InvoiceCode { get; set; } = null!;

    [Column("booking_id")]
    public int BookingId { get; set; }

    [ForeignKey(nameof(BookingId))]
    public virtual Booking Booking { get; set; } = null!;

    [Column("customer_id")]
    public int CustomerId { get; set; }

    [ForeignKey(nameof(CustomerId))]
    public virtual Customer Customer { get; set; } = null!;

    [Column("account_id")]
    public int? AccountId { get; set; }

    [ForeignKey(nameof(AccountId))]
    public virtual Account? Account { get; set; }

    [Column("subtotal_room", TypeName = "decimal(15,2)")]
    public decimal SubtotalRoom { get; set; }

    [Column("subtotal_services", TypeName = "decimal(15,2)")]
    public decimal SubtotalServices { get; set; }

    [Column("tax_amount", TypeName = "decimal(15,2)")]
    public decimal TaxAmount { get; set; }

    [Column("discount_amount", TypeName = "decimal(15,2)")]
    public decimal DiscountAmount { get; set; }

    [Column("total_amount", TypeName = "decimal(15,2)")]
    public decimal TotalAmount { get; set; }

    [MaxLength(50)]
    [Column("payment_method")]
    public string? PaymentMethod { get; set; }

    [MaxLength(50)]
    [Column("payment_status")]
    public string PaymentStatus { get; set; } = "Chưa thanh toán";

    [Column("issued_at")]
    public DateTime? IssuedAt { get; set; } = DateTime.UtcNow;
}
