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

        // GET: api/Rooms
        [HttpGet]
        [AllowAnonymous]
        public ActionResult<object> GetRoom(
            [FromQuery] string? q,
            [FromQuery] string? roomType,
            [FromQuery] string? status,
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

        // GET: api/Rooms/5
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<Room>> GetRoom(int id)
        {
            var room = await _context.Room
                .AsNoTracking()
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (room == null)
            {
                return NotFound();
            }

            return room;
        }

        // PUT: api/Rooms/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> PutRoom(int id, Room room)
        {
            if (id != room.Id)
            {
                return BadRequest();
            }

            _context.Entry(room).State = EntityState.Modified;

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

        // POST: api/Rooms
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateRoom(CreateRoomRequest request)
        {
            var room = new Room
            {
                CardName = request.Name,
                RoomType = request.RoomType,
                PricePerNight = request.PricePerNight,
                Description = request.Description
            };

            _context.Room.Add(room);
            await _context.SaveChangesAsync();

            // 🔥 thêm ảnh
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

        // DELETE: api/Rooms/5
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

        public class CreateRoomRequest
        {
            public string? Name { get; set; }
            public string? RoomType { get; set; }
            public decimal PricePerNight { get; set; }
            public string? Description { get; set; }
            public List<string> Images { get; set; } = new();
        }
    }
}
