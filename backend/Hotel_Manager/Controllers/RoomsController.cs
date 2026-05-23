using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_Manager.Data;
using Hotel_Manager.Modal;
using X.PagedList;

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RoomsController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;

        public RoomsController(Hotel_ManagerContext context)
        {
            _context = context;
        }

        
        [HttpGet]
        [Authorize(Roles = "Admin,Receptionist")]
        [AllowAnonymous]
        public ActionResult<object> GetRoom(
            [FromQuery] string? q,
            [FromQuery] string? roomType,
            [FromQuery] string? status,
            [FromQuery] bool publicOnly = false,
            [FromQuery] bool availableOnly = false,
            [FromQuery] DateTime? checkInDate = null,
            [FromQuery] DateTime? checkOutDate = null,
            [FromQuery] string? sortBy = "updatedAt",
            [FromQuery] string? sortDir = "desc",
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            pageNumber = pageNumber < 1 ? 1 : pageNumber;
            pageSize = pageSize < 1 ? 10 : pageSize;
            pageSize = pageSize > 100 ? 100 : pageSize;

            IQueryable<Room> query = _context.Room
                .AsNoTracking()
                .Include(r => r.Images);

            if (!string.IsNullOrWhiteSpace(q))
            {
                string keyword = q.Trim().ToLower();
                query = query.Where(r =>
                    (r.CardName != null && r.CardName.ToLower().Contains(keyword)) ||
                    (r.RoomType != null && r.RoomType.ToLower().Contains(keyword)) ||
                    (r.Description != null && r.Description.ToLower().Contains(keyword))
                );
            }

            if (!string.IsNullOrWhiteSpace(roomType))
            {
                string typeFilter = roomType.Trim().ToLower();
                query = query.Where(r => r.RoomType != null && r.RoomType.ToLower() == typeFilter);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                string statusFilter = status.Trim().ToLower();
                query = query.Where(r => r.Status != null && r.Status.ToLower() == statusFilter);
            }

            if (publicOnly || availableOnly)
            {
                query = query.Where(r =>
                    r.Status == null ||
                    r.Status.ToLower() == "trống" ||
                    r.Status.ToLower() == "phòng trống" ||
                    r.Status.ToLower() == "available" ||
                    r.Status.ToLower() == "hoạt động" ||
                    r.Status.ToLower() == "hoat dong" ||
                    r.Status.ToLower() == "sẵn sàng" ||
                    r.Status.ToLower() == "san sang");
            }

            if (checkInDate.HasValue && checkOutDate.HasValue && checkOutDate.Value.Date > checkInDate.Value.Date)
            {
                var blockedRoomIds = _context.Booking
                    .AsNoTracking()
                    .Where(b =>
                        b.CheckInDate < checkOutDate.Value.Date &&
                        b.CheckOutDate > checkInDate.Value.Date &&
                        b.Status != null &&
                        b.Status.ToLower() != "đã hủy" &&
                        b.Status.ToLower() != "da huy" &&
                        b.Status.ToLower() != "cancelled" &&
                        b.Status.ToLower() != "hủy" &&
                        b.Status.ToLower() != "đã check-out" &&
                        b.Status.ToLower() != "da check-out")
                    .Select(b => b.RoomId)
                    .Distinct()
                    .ToList();

                if (blockedRoomIds.Count > 0)
                {
                    query = query.Where(r => !blockedRoomIds.Contains(r.Id));
                }
            }

            string normalizedSortBy = (sortBy ?? "updatedAt").Trim().ToLower();
            bool isAsc = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);

            query = normalizedSortBy switch
            {
                "name" => isAsc ? query.OrderBy(r => r.CardName) : query.OrderByDescending(r => r.CardName),
                "price" => isAsc ? query.OrderBy(r => r.PricePerNight) : query.OrderByDescending(r => r.PricePerNight),
                "status" => isAsc ? query.OrderBy(r => r.Status) : query.OrderByDescending(r => r.Status),
                "createdat" => isAsc ? query.OrderBy(r => r.CreatedAt) : query.OrderByDescending(r => r.CreatedAt),
                _ => isAsc ? query.OrderBy(r => r.UpdatedAt) : query.OrderByDescending(r => r.UpdatedAt),
            };

            int totalCount = query.Count();
            List<Room> pageItems = query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            IPagedList<Room> paged = new StaticPagedList<Room>(
                pageItems,
                pageNumber,
                pageSize,
                totalCount
            );

            return Ok(new
            {
                items = paged,
                pageNumber = paged.PageNumber,
                pageSize = paged.PageSize,
                totalCount = paged.TotalItemCount,
                totalPages = paged.PageCount,
                hasNextPage = paged.HasNextPage,
                hasPreviousPage = paged.HasPreviousPage
            });
        }

        
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<Room>> GetRoom(
            int id,
            [FromQuery] bool publicOnly = false,
            [FromQuery] DateTime? checkInDate = null,
            [FromQuery] DateTime? checkOutDate = null)
        {
            var room = await _context.Room
                .AsNoTracking()
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (room == null)
            {
                return NotFound();
            }

            if (publicOnly && !IsRoomPubliclyAvailableStatus(room.Status))
            {
                return NotFound(new { message = "Phòng này hiện không còn khả dụng." });
            }

            if (publicOnly
                && checkInDate.HasValue
                && checkOutDate.HasValue
                && checkOutDate.Value.Date > checkInDate.Value.Date)
            {
                bool hasConflict = await _context.Booking
                    .AsNoTracking()
                    .AnyAsync(b =>
                        b.RoomId == id &&
                        b.CheckInDate < checkOutDate.Value.Date &&
                        b.CheckOutDate > checkInDate.Value.Date &&
                        b.Status != null &&
                        b.Status.ToLower() != "đã hủy" &&
                        b.Status.ToLower() != "da huy" &&
                        b.Status.ToLower() != "cancelled" &&
                        b.Status.ToLower() != "hủy" &&
                        b.Status.ToLower() != "đã check-out" &&
                        b.Status.ToLower() != "da check-out");

                if (hasConflict)
                {
                    return NotFound(new { message = "Phòng này đã được đặt trong khoảng ngày bạn chọn." });
                }
            }

            return room;
        }

        
        
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> PutRoom(int id, UpdateRoomRequest request)
        {
            if (id != request.Id)
            {
                return BadRequest();
            }

            var room = await _context.Room
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (room == null)
            {
                return NotFound();
            }

            room.CardName = request.CardName?.Trim() ?? room.CardName;
            room.RoomType = request.RoomType?.Trim() ?? room.RoomType;
            room.PricePerNight = request.PricePerNight;
            room.Status = string.IsNullOrWhiteSpace(request.Status) ? room.Status : request.Status.Trim();
            room.Description = request.Description;
            room.UpdatedAt = DateTime.UtcNow;

            if (request.Images != null)
            {
                var normalizedImages = request.Images
                    .Where(url => !string.IsNullOrWhiteSpace(url))
                    .Select(url => url.Trim())
                    .Distinct()
                    .ToList();

                _context.RoomImages.RemoveRange(room.Images);
                room.Images = normalizedImages.Select(url => new RoomImage
                {
                    RoomId = room.Id,
                    ImageUrl = url
                }).ToList();
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!RoomExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        
        
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateRoom(CreateRoomRequest request)
        {
            var room = new Room
            {
                CardName = request.Name,
                RoomType = request.RoomType,
                PricePerNight = request.PricePerNight,
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Trống" : request.Status.Trim(),
                Description = request.Description,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Room.Add(room);
            await _context.SaveChangesAsync();

            
            if (request.Images != null && request.Images.Any())
            {
                var images = request.Images.Select(url => new RoomImage
                {
                    RoomId = room.Id,
                    ImageUrl = url
                });

                _context.RoomImages.AddRange(images);
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Tạo phòng thành công" });
        }

        
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteRoom(int id)
        {
            var room = await _context.Room.FindAsync(id);
            if (room == null)
            {
                return NotFound();
            }

            _context.Room.Remove(room);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool RoomExists(int id)
        {
            return _context.Room.Any(e => e.Id == id);
        }

        private static bool IsRoomPubliclyAvailableStatus(string? status)
        {
            string normalized = (status ?? string.Empty).Trim().ToLower();
            return normalized == string.Empty
                || normalized == "trống"
                || normalized == "phòng trống"
                || normalized == "available"
                || normalized == "hoạt động"
                || normalized == "hoat dong"
                || normalized == "sẵn sàng"
                || normalized == "san sang";
        }

        private static bool IsInactiveBookingStatus(string? status)
        {
            string normalized = (status ?? string.Empty).Trim().ToLower();
            return normalized == "đã hủy"
                || normalized == "da huy"
                || normalized == "cancelled"
                || normalized == "hủy"
                || normalized == "đã check-out"
                || normalized == "da check-out";
        }

        public class CreateRoomRequest
        {
            public string? Name { get; set; }
            public string? RoomType { get; set; }
            public decimal PricePerNight { get; set; }
            public string? Status { get; set; }
            public string? Description { get; set; }
            public List<string> Images { get; set; } = new();
        }

        public class UpdateRoomRequest
        {
            public int Id { get; set; }
            public string? CardName { get; set; }
            public string? RoomType { get; set; }
            public decimal PricePerNight { get; set; }
            public string? Status { get; set; }
            public string? Description { get; set; }
            public List<string>? Images { get; set; }
        }
    }
}
