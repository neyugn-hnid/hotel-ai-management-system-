
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.EntityFrameworkCore;
namespace Hotel_Manager.Modal;


[Table("rooms")]
public class Room
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("name")]
    public string CardName { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    [Column("room_type")]
    public string RoomType { get; set; } = null!;

    [Column("price_per_night")]
    public decimal PricePerNight { get; set; }

    [MaxLength(50)]
    [Column("status")]
    public string Status { get; set; } = "Trống";


    [Column("description")]
    public string? Description { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

    
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    public virtual ICollection<RoomImage> Images { get; set; } = new List<RoomImage>();
}


