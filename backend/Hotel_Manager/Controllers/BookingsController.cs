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
using Hotel_Manager.Services.BookingAi;

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BookingsController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;
        private readonly IBookingRecommendationService _bookingRecommendationService;

        public BookingsController(
            Hotel_ManagerContext context,
            IBookingRecommendationService bookingRecommendationService)
        {
            _context = context;
            _bookingRecommendationService = bookingRecommendationService;
        }

        // GET: api/Bookings
        [HttpGet]
        [Authorize(Roles = "Admin,Lễ tân")]
        public ActionResult<object> GetBooking(
            [FromQuery] string? q,
            [FromQuery] string? status,
            [FromQuery] string? sortBy = "createdAt",
            [FromQuery] string? sortDir = "desc",
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            pageNumber = pageNumber < 1 ? 1 : pageNumber;
            pageSize = pageSize < 1 ? 10 : pageSize;
            pageSize = pageSize > 100 ? 100 : pageSize;

            IQueryable<Booking> query = _context.Booking
                .AsNoTracking()
                .Include(b => b.Customer)
                .Include(b => b.Room);

            if (!string.IsNullOrWhiteSpace(q))
            {
                string keyword = q.Trim().ToLower();
                query = query.Where(b =>
                    (b.BookingCode != null && b.BookingCode.ToLower().Contains(keyword)) ||
                    (b.Status != null && b.Status.ToLower().Contains(keyword)) ||
                    (b.Customer != null && b.Customer.FullName != null && b.Customer.FullName.ToLower().Contains(keyword)) ||
                    (b.Customer != null && b.Customer.Email != null && b.Customer.Email.ToLower().Contains(keyword))
                );
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                string statusFilter = status.Trim().ToLower();
                query = query.Where(b => b.Status != null && b.Status.ToLower() == statusFilter);
            }

            string normalizedSortBy = (sortBy ?? "createdAt").Trim().ToLower();
            bool isAsc = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);

            query = normalizedSortBy switch
            {
                "bookingcode" => isAsc ? query.OrderBy(b => b.BookingCode) : query.OrderByDescending(b => b.BookingCode),
                "customer" => isAsc ? query.OrderBy(b => b.Customer.FullName) : query.OrderByDescending(b => b.Customer.FullName),
                "room" => isAsc ? query.OrderBy(b => b.Room.CardName) : query.OrderByDescending(b => b.Room.CardName),
                "checkindate" => isAsc ? query.OrderBy(b => b.CheckInDate) : query.OrderByDescending(b => b.CheckInDate),
                "checkoutdate" => isAsc ? query.OrderBy(b => b.CheckOutDate) : query.OrderByDescending(b => b.CheckOutDate),
                "amount" => isAsc ? query.OrderBy(b => b.TotalRoomAmount) : query.OrderByDescending(b => b.TotalRoomAmount),
                "status" => isAsc ? query.OrderBy(b => b.Status) : query.OrderByDescending(b => b.Status),
                _ => isAsc ? query.OrderBy(b => b.CreatedAt) : query.OrderByDescending(b => b.CreatedAt)
            };

            int totalCount = query.Count();
            List<Booking> pageItems = query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var responseItems = pageItems.Select(b => new
            {
                id = b.Id,
                bookingCode = b.BookingCode,
                customerId = b.CustomerId,
                customerName = b.Customer?.FullName,
                customerEmail = b.Customer?.Email,
                roomId = b.RoomId,
                roomName = b.Room?.CardName,
                roomType = b.Room?.RoomType,
                accountId = b.AccountId,
                accountName = b.Account != null ? b.Account.FullName : null,
                status = b.Status,
                checkInDate = b.CheckInDate,
                checkOutDate = b.CheckOutDate,
                totalRoomAmount = b.TotalRoomAmount,
                aiMatchScore = b.AiMatchScore,
                notes = b.Notes,
                createdAt = b.CreatedAt,
                updatedAt = b.UpdatedAt
            }).ToList();

            IPagedList<object> paged = new StaticPagedList<object>(
                responseItems,
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

        // GET: api/Bookings/5
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,Lễ tân")]
        public async Task<ActionResult<Booking>> GetBooking(int id)
        {
            var booking = await _context.Booking.FindAsync(id);

            if (booking == null)
            {
                return NotFound();
            }

            return booking;
        }

        // PUT: api/Bookings/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Lễ tân")]
        public async Task<IActionResult> PutBooking(int id, Booking booking)
        {
            if (id != booking.Id)
            {
                return BadRequest();
            }

            _context.Entry(booking).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!BookingExists(id))
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

        // POST: api/Bookings
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult<Booking>> PostBooking(CreateBookingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.BookingCode))
            {
                return BadRequest(new { message = "Mã đặt phòng không hợp lệ" });
            }

            if (request.CustomerId <= 0)
            {
                return BadRequest(new { message = "Khách hàng không hợp lệ" });
            }

            if (request.RoomId <= 0)
            {
                return BadRequest(new { message = "Phòng không hợp lệ" });
            }

            if (request.CheckOutDate <= request.CheckInDate)
            {
                return BadRequest(new { message = "Ngày trả phòng phải sau ngày nhận phòng" });
            }

            var customerExists = await _context.Customer.AnyAsync(c => c.Id == request.CustomerId);
            if (!customerExists)
            {
                return BadRequest(new { message = "Không tìm thấy khách hàng" });
            }

            var roomExists = await _context.Room.AnyAsync(r => r.Id == request.RoomId);
            if (!roomExists)
            {
                return BadRequest(new { message = "Không tìm thấy phòng" });
            }

            var booking = new Booking
            {
                BookingCode = request.BookingCode.Trim(),
                CustomerId = request.CustomerId,
                RoomId = request.RoomId,
                AccountId = request.AccountId,
                CheckInDate = request.CheckInDate,
                CheckOutDate = request.CheckOutDate,
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Chờ xác nhận" : request.Status.Trim(),
                TotalRoomAmount = request.TotalRoomAmount,
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Booking.Add(booking);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetBooking", new { id = booking.Id }, booking);
        }

        // DELETE: api/Bookings/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteBooking(int id)
        {
            var booking = await _context.Booking.FindAsync(id);
            if (booking == null)
            {
                return NotFound();
            }

            _context.Booking.Remove(booking);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPatch("{id}/status")]
        [Authorize(Roles = "Admin,Lễ tân")]
        public async Task<IActionResult> UpdateBookingStatus(int id, UpdateBookingStatusRequest request)
        {
            var booking = await _context.Booking.FindAsync(id);
            if (booking == null)
            {
                return NotFound(new { message = "Không tìm thấy booking" });
            }

            if (string.IsNullOrWhiteSpace(request.Status))
            {
                return BadRequest(new { message = "Trạng thái không hợp lệ" });
            }

            booking.Status = request.Status.Trim();
            if (request.AccountId.HasValue && request.AccountId.Value > 0)
            {
                booking.AccountId = request.AccountId.Value;
            }
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Cập nhật trạng thái booking thành công" });
        }

        [HttpPost("ai/recommend")]
        [AllowAnonymous]
        public async Task<ActionResult<BookingAiRecommendResultDto>> RecommendRoom(
            [FromBody] BookingAiRecommendRequestDto request,
            CancellationToken cancellationToken)
        {
            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            try
            {
                var result = await _bookingRecommendationService.RecommendAsync(request, cancellationToken);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        private bool BookingExists(int id)
        {
            return _context.Booking.Any(e => e.Id == id);
        }

        public class UpdateBookingStatusRequest
        {
            public string? Status { get; set; }
            public int? AccountId { get; set; }
        }

        public class CreateBookingRequest
        {
            public string BookingCode { get; set; } = string.Empty;
            public int CustomerId { get; set; }
            public int RoomId { get; set; }
            public int? AccountId { get; set; }
            public DateTime CheckInDate { get; set; }
            public DateTime CheckOutDate { get; set; }
            public string? Status { get; set; }
            public decimal TotalRoomAmount { get; set; }
            public string? Notes { get; set; }
        }

    }
}
