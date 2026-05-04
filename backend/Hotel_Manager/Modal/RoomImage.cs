using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Hotel_Manager.Modal
{
    [Table("room_images")]
    public class RoomImage
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("room_id")]
        public int RoomId { get; set; }

        [JsonIgnore]
        [ForeignKey(nameof(RoomId))]
        public virtual Room Room { get; set; } = null!;

        [Required]
        [Column("image_url")]
        public string ImageUrl { get; set; } = null!;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    }
}
