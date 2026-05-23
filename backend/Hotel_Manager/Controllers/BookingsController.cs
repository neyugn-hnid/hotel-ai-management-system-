using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_Manager.Data;
using Hotel_Manager.Hubs;
using Hotel_Manager.Modal;
using X.PagedList;
using Hotel_Manager.Services.BookingAi;
using Microsoft.AspNetCore.SignalR;

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BookingsController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;
        private readonly IBookingRecommendationService _bookingRecommendationService;
        private readonly IHubContext<BookingHub> _bookingHubContext;

        public BookingsController(
            Hotel_ManagerContext context,
            IBookingRecommendationService bookingRecommendationService,
            IHubContext<BookingHub> bookingHubContext)
        {
            _context = context;
            _bookingRecommendationService = bookingRecommendationService;
            _bookingHubContext = bookingHubContext;
        }

        
        [HttpGet]
        [Authorize(Roles = "Admin,Receptionist")]
        public ActionResult<object> GetBooking(
            [FromQuery] string? q,
            [FromQuery] string? status,
            [FromQuery] string? source,
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

            if (!string.IsNullOrWhiteSpace(source))
            {
                string sourceFilter = source.Trim().ToLower();
                if (sourceFilter == "website" || sourceFilter == "web")
                {
                    query = query.Where(b =>
                        (b.BookingCode != null && b.BookingCode.ToUpper().StartsWith("BKG-WEB")) ||
                        (b.Notes != null && (
                            b.Notes.ToLower().Contains("website") ||
                            b.Notes.ToLower().Contains("đặt qua web") ||
                            b.Notes.ToLower().Contains("dat qua web")
                        )) ||
                        !b.AccountId.HasValue ||
                        b.AccountId.Value <= 0
                    );
                }
                else if (sourceFilter == "internal")
                {
                    query = query.Where(b =>
                        b.AccountId.HasValue &&
                        b.AccountId.Value > 0 &&
                        (b.BookingCode == null || !b.BookingCode.ToUpper().StartsWith("BKG-WEB")) &&
                        (b.Notes == null || (
                            !b.Notes.ToLower().Contains("website") &&
                            !b.Notes.ToLower().Contains("đặt qua web") &&
                            !b.Notes.ToLower().Contains("dat qua web")
                        ))
                    );
                }
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
                source = ResolveBookingSource(b.BookingCode, b.Notes, b.AccountId),
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

        
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,Receptionist")]
        public async Task<ActionResult<object>> GetBooking(int id)
        {
            var booking = await _context.Booking
                .AsNoTracking()
                .Include(b => b.Customer)
                .Include(b => b.Room)
                .Include(b => b.Account)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null)
            {
                return NotFound();
            }

            return Ok(ToBookingResponse(booking));
        }

        
        
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Receptionist")]
        public async Task<IActionResult> PutBooking(int id, UpdateBookingRequest request)
        {
            if (id != request.Id)
            {
                return BadRequest();
            }

            var booking = await _context.Booking.FindAsync(id);
            if (booking == null)
            {
                return NotFound();
            }

            if (request.CustomerId <= 0 || request.RoomId <= 0)
            {
                return BadRequest(new { message = "Khách hàng hoặc phòng không hợp lệ" });
            }

            if (request.CheckOutDate <= request.CheckInDate)
            {
                return BadRequest(new { message = "Ngày trả phòng phải sau ngày nhận phòng" });
            }

            booking.BookingCode = string.IsNullOrWhiteSpace(request.BookingCode) ? booking.BookingCode : request.BookingCode.Trim();
            booking.CustomerId = request.CustomerId;
            booking.RoomId = request.RoomId;
            booking.AccountId = request.AccountId;
            booking.CheckInDate = request.CheckInDate;
            booking.CheckOutDate = request.CheckOutDate;
            booking.Status = string.IsNullOrWhiteSpace(request.Status) ? booking.Status : request.Status.Trim();
            booking.TotalRoomAmount = request.TotalRoomAmount;
            booking.Notes = request.Notes;
            booking.UpdatedAt = DateTime.UtcNow;

            try
            {
                await _context.SaveChangesAsync();
                await SyncRoomStatusForBookingAsync(booking.RoomId, booking.Status);
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

        
        
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult<object>> PostBooking([FromBody] CreateBookingRequest? request)
        {
            if (request == null)
            {
                return BadRequest(new { message = "Dữ liệu đặt phòng không hợp lệ" });
            }

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

            if (request.AccountId.HasValue)
            {
                if (request.AccountId.Value <= 0)
                {
                    return BadRequest(new { message = "Tài khoản xử lý không hợp lệ" });
                }

                var accountExists = await _context.Account.AnyAsync(a => a.Id == request.AccountId.Value);
                if (!accountExists)
                {
                    return BadRequest(new { message = "Không tìm thấy tài khoản xử lý" });
                }
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

            try
            {
                _context.Booking.Add(booking);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return BadRequest(new { message = "Không thể tạo booking do dữ liệu không hợp lệ hoặc vi phạm ràng buộc" });
            }

            await SyncRoomStatusForBookingAsync(booking.RoomId, booking.Status);
            await _bookingHubContext.Clients.All.SendAsync("bookingCreated", new
            {
                bookingId = booking.Id,
                bookingCode = booking.BookingCode,
                status = booking.Status,
                createdAt = booking.CreatedAt,
                source = ResolveBookingSource(booking.BookingCode, booking.Notes, booking.AccountId)
            });

            var createdBooking = await _context.Booking
                .AsNoTracking()
                .Include(b => b.Customer)
                .Include(b => b.Room)
                .Include(b => b.Account)
                .FirstOrDefaultAsync(b => b.Id == booking.Id);

            if (createdBooking == null)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Không thể đọc lại booking vừa tạo" });
            }

            return CreatedAtAction("GetBooking", new { id = booking.Id }, ToBookingResponse(createdBooking));
        }

        
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
        [Authorize(Roles = "Admin,Receptionist")]
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
            await SyncRoomStatusForBookingAsync(booking.RoomId, booking.Status);
            await _bookingHubContext.Clients.All.SendAsync("bookingUpdated", new
            {
                bookingId = booking.Id,
                bookingCode = booking.BookingCode,
                status = booking.Status,
                updatedAt = booking.UpdatedAt
            });

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

        private async Task SyncRoomStatusForBookingAsync(int roomId, string? bookingStatus)
        {
            if (roomId <= 0)
            {
                return;
            }

            var room = await _context.Room.FindAsync(roomId);
            if (room == null)
            {
                return;
            }

            var nextRoomStatus = ResolveRoomStatusFromBookingStatus(bookingStatus);
            if (string.IsNullOrWhiteSpace(nextRoomStatus))
            {
                return;
            }

            room.Status = nextRoomStatus;
            room.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        private static string? ResolveRoomStatusFromBookingStatus(string? bookingStatus)
        {
            var normalized = (bookingStatus ?? string.Empty).Trim().ToLowerInvariant();

            if (normalized == "chờ xác nhận" || normalized == "cho xac nhan")
            {
                return "Đã đặt";
            }

            if (normalized == "đã xác nhận giữ chỗ" || normalized == "da xac nhan giu cho" || normalized == "đã xác nhận" || normalized == "da xac nhan")
            {
                return "Đã đặt";
            }

            if (normalized == "đã check-in" || normalized == "da check-in" || normalized == "check-in" || normalized == "đang ở" || normalized == "dang o")
            {
                return "Đang sử dụng";
            }

            if (normalized == "đã check-out" || normalized == "da check-out" || normalized == "check-out" || normalized == "đã rời đi" || normalized == "da roi di" || normalized == "đã hủy" || normalized == "da huy" || normalized == "cancelled")
            {
                return "Trống";
            }

            return null;
        }

        public class UpdateBookingStatusRequest
        {
            public string? Status { get; set; }
            public int? AccountId { get; set; }
        }

        public class UpdateBookingRequest
        {
            public int Id { get; set; }
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

        private static object ToBookingResponse(Booking b)
        {
            return new
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
                accountName = b.Account?.FullName,
                status = b.Status,
                checkInDate = b.CheckInDate,
                checkOutDate = b.CheckOutDate,
                totalRoomAmount = b.TotalRoomAmount,
                aiMatchScore = b.AiMatchScore,
                notes = b.Notes,
                source = ResolveBookingSource(b.BookingCode, b.Notes, b.AccountId),
                createdAt = b.CreatedAt,
                updatedAt = b.UpdatedAt
            };
        }

        private static string ResolveBookingSource(string? bookingCode, string? notes, int? accountId)
        {
            var normalizedCode = (bookingCode ?? string.Empty).Trim().ToUpperInvariant();
            var normalizedNotes = (notes ?? string.Empty).Trim().ToLowerInvariant();

            if (normalizedCode.StartsWith("BKG-WEB", StringComparison.OrdinalIgnoreCase)
                || normalizedNotes.Contains("website")
                || normalizedNotes.Contains("đặt qua web")
                || normalizedNotes.Contains("dat qua web"))
            {
                return "website";
            }

            return accountId.HasValue && accountId.Value > 0 ? "internal" : "website";
        }

    }
}
