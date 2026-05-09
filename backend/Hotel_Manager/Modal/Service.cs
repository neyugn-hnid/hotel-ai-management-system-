using Hotel_Manager.Modal;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace Hotel_Manager.Modal;

[Table("services")]
public class Service
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(150)]
    [Column("service_name")]
    public string ServiceName { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    [Column("category")]
    public string Category { get; set; } = null!;

    [Column("price")]
    public decimal Price { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [MaxLength(50)]
    [Column("status")]
    public string Status { get; set; } = "Hoạt động";

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

    
    public virtual ICollection<BookingService> BookingServices { get; set; } = new List<BookingService>();
}
