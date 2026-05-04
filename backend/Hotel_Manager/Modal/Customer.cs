using Hotel_Manager.Modal;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hotel_Manager.Modal;
[Table("customers")]
public class Customer
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("full_name")]
    public string FullName { get; set; } = null!;

    [MaxLength(150)]
    [Column("email")]
    public string? Email { get; set; }

    [MaxLength(20)]
    [Column("phone_number")]
    public string? PhoneNumber { get; set; }

    [MaxLength(50)]
    [Column("identity_card")]
    public string? IdentityCard { get; set; }

    [MaxLength(50)]
    [Column("status")]
    public string? Status { get; set; }

    [Column("ai_preferences")]
    public string? AiPreferences { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}
