using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hotel_Manager.Modal
{
    [Table("accounts")]
    public class Account
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("full_name")]
        public string FullName { get; set; } = null!;

        [Required]
        [MaxLength(150)]
        [Column("email")]
        public string Email { get; set; } = null!;

        [MaxLength(20)]
        [Column("phone_number")]
        public string? PhoneNumber { get; set; }

        [Required]
        [MaxLength(255)]
        [Column("password_hash")]
        public string PasswordHash { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        [Column("role")]
        public string Role { get; set; } = null!;

        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = "Hoạt động";

        [MaxLength(20)]
        [Column("avatar_color")]
        public string? AvatarColor { get; set; }

        [Column("last_login_at")]
        public DateTime? LastLoginAt { get; set; }

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
        public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    }
}
