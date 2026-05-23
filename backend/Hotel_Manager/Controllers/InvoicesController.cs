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

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,Receptionist")]
    public class InvoicesController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;

        public InvoicesController(Hotel_ManagerContext context)
        {
            _context = context;
        }

        
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetInvoice()
        {
            var invoices = await _context.Invoice
                .AsNoTracking()
                .Include(i => i.Booking)
                    .ThenInclude(b => b.BookingServices)
                        .ThenInclude(bs => bs.Service)
                .ToListAsync();

            return Ok(invoices.Select(ToInvoiceResponse));
        }

        
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetInvoice(int id)
        {
            var invoice = await _context.Invoice
                .AsNoTracking()
                .Include(i => i.Booking)
                    .ThenInclude(b => b.BookingServices)
                        .ThenInclude(bs => bs.Service)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null)
            {
                return NotFound();
            }

            return Ok(ToInvoiceResponse(invoice));
        }

        
        
        [HttpPut("{id}")]
        public async Task<IActionResult> PutInvoice(int id, InvoiceUpsertRequest request)
        {
            var invoice = await _context.Invoice.FindAsync(id);
            if (invoice == null)
            {
                return NotFound(new { message = "Không tìm thấy hóa đơn" });
            }

            if (request.BookingId <= 0 || request.CustomerId <= 0)
            {
                return BadRequest(new { message = "Thiếu thông tin booking hoặc khách hàng" });
            }

            if (request.TotalAmount < 0 || request.SubtotalRoom < 0 || request.SubtotalServices < 0)
            {
                return BadRequest(new { message = "Số tiền không hợp lệ" });
            }

            invoice.InvoiceCode = string.IsNullOrWhiteSpace(request.InvoiceCode) ? invoice.InvoiceCode : request.InvoiceCode.Trim();
            invoice.BookingId = request.BookingId;
            invoice.CustomerId = request.CustomerId;
            invoice.AccountId = request.AccountId;
            invoice.SubtotalRoom = request.SubtotalRoom;
            invoice.SubtotalServices = request.SubtotalServices;
            invoice.TaxAmount = request.TaxAmount;
            invoice.DiscountAmount = request.DiscountAmount;
            invoice.TotalAmount = request.TotalAmount;
            invoice.PaymentMethod = request.PaymentMethod;
            invoice.PaymentStatus = string.IsNullOrWhiteSpace(request.PaymentStatus) ? invoice.PaymentStatus : request.PaymentStatus.Trim();
            invoice.IssuedAt = request.IssuedAt ?? invoice.IssuedAt;
            await SyncBookingServicesAsync(request.BookingId, request.ServiceIds);
            await ApplyPaidInvoiceEffectsAsync(request.BookingId, invoice.PaymentStatus);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!InvoiceExists(id))
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
        public async Task<ActionResult<Invoice>> PostInvoice(InvoiceUpsertRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.InvoiceCode))
            {
                return BadRequest(new { message = "Mã hóa đơn không hợp lệ" });
            }

            if (request.BookingId <= 0 || request.CustomerId <= 0)
            {
                return BadRequest(new { message = "Thiếu thông tin booking hoặc khách hàng" });
            }

            var bookingExists = await _context.Booking.AnyAsync(b => b.Id == request.BookingId);
            if (!bookingExists)
            {
                return BadRequest(new { message = "Không tìm thấy booking" });
            }

            var customerExists = await _context.Customer.AnyAsync(c => c.Id == request.CustomerId);
            if (!customerExists)
            {
                return BadRequest(new { message = "Không tìm thấy khách hàng" });
            }

            var invoice = new Invoice
            {
                InvoiceCode = request.InvoiceCode.Trim(),
                BookingId = request.BookingId,
                CustomerId = request.CustomerId,
                AccountId = request.AccountId,
                SubtotalRoom = request.SubtotalRoom,
                SubtotalServices = request.SubtotalServices,
                TaxAmount = request.TaxAmount,
                DiscountAmount = request.DiscountAmount,
                TotalAmount = request.TotalAmount,
                PaymentMethod = request.PaymentMethod,
                PaymentStatus = string.IsNullOrWhiteSpace(request.PaymentStatus) ? "Chưa thanh toán" : request.PaymentStatus.Trim(),
                IssuedAt = request.IssuedAt ?? DateTime.UtcNow
            };

            _context.Invoice.Add(invoice);
            await SyncBookingServicesAsync(request.BookingId, request.ServiceIds);
            await ApplyPaidInvoiceEffectsAsync(request.BookingId, invoice.PaymentStatus);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetInvoice", new { id = invoice.Id }, invoice);
        }

        
        [HttpDelete("{id}")]
            [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteInvoice(int id)
        {
            var invoice = await _context.Invoice.FindAsync(id);
            if (invoice == null)
            {
                return NotFound();
            }

            _context.Invoice.Remove(invoice);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool InvoiceExists(int id)
        {
            return _context.Invoice.Any(e => e.Id == id);
        }

        private async Task SyncBookingServicesAsync(int bookingId, List<int>? serviceIds)
        {
            if (bookingId <= 0)
            {
                return;
            }

            var normalizedServiceIds = (serviceIds ?? new List<int>())
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            var existingRows = await _context.BookingService
                .Where(bs => bs.BookingId == bookingId)
                .ToListAsync();

            if (existingRows.Count > 0)
            {
                _context.BookingService.RemoveRange(existingRows);
            }

            if (normalizedServiceIds.Count == 0)
            {
                return;
            }

            var services = await _context.Service
                .Where(s => normalizedServiceIds.Contains(s.Id))
                .ToListAsync();

            var bookingServices = services.Select(service => new BookingService
            {
                BookingId = bookingId,
                ServiceId = service.Id,
                Quantity = 1,
                UnitPrice = service.Price,
                TotalPrice = service.Price,
                ProvidedAt = DateTime.UtcNow
            });

            _context.BookingService.AddRange(bookingServices);
        }

        private async Task ApplyPaidInvoiceEffectsAsync(int bookingId, string? paymentStatus)
        {
            if (bookingId <= 0 || !IsPaidStatus(paymentStatus))
            {
                return;
            }

            var booking = await _context.Booking
                .Include(b => b.Room)
                .FirstOrDefaultAsync(b => b.Id == bookingId);

            if (booking == null)
            {
                return;
            }

            booking.Status = "Đã check-out";
            booking.UpdatedAt = DateTime.UtcNow;

            if (booking.Room != null)
            {
                booking.Room.Status = "Trống";
                booking.Room.UpdatedAt = DateTime.UtcNow;
            }
        }

        private static bool IsPaidStatus(string? paymentStatus)
        {
            var normalized = (paymentStatus ?? string.Empty).Trim().ToLower();
            return normalized == "đã thanh toán"
                || normalized == "da thanh toan"
                || normalized == "hoàn tất thanh toán"
                || normalized == "hoan tat thanh toan"
                || normalized == "paid";
        }

        private static object ToInvoiceResponse(Invoice invoice)
        {
            var bookingServices = (invoice.Booking?.BookingServices ?? Enumerable.Empty<BookingService>())
                .Where(bs => bs.Service != null)
                .Select(bs => new
                {
                    id = bs.Id,
                    serviceId = bs.ServiceId,
                    serviceName = bs.Service.ServiceName,
                    quantity = bs.Quantity,
                    unitPrice = bs.UnitPrice,
                    totalPrice = bs.TotalPrice
                })
                .ToList();

            return new
            {
                id = invoice.Id,
                invoiceCode = invoice.InvoiceCode,
                bookingId = invoice.BookingId,
                customerId = invoice.CustomerId,
                accountId = invoice.AccountId,
                subtotalRoom = invoice.SubtotalRoom,
                subtotalServices = invoice.SubtotalServices,
                taxAmount = invoice.TaxAmount,
                discountAmount = invoice.DiscountAmount,
                totalAmount = invoice.TotalAmount,
                paymentMethod = invoice.PaymentMethod,
                paymentStatus = invoice.PaymentStatus,
                issuedAt = invoice.IssuedAt,
                services = bookingServices
            };
        }

        public class InvoiceUpsertRequest
        {
            public string InvoiceCode { get; set; } = string.Empty;
            public int BookingId { get; set; }
            public int CustomerId { get; set; }
            public int? AccountId { get; set; }
            public decimal SubtotalRoom { get; set; }
            public decimal SubtotalServices { get; set; }
            public decimal TaxAmount { get; set; }
            public decimal DiscountAmount { get; set; }
            public decimal TotalAmount { get; set; }
            public string? PaymentMethod { get; set; }
            public string? PaymentStatus { get; set; }
            public DateTime? IssuedAt { get; set; }
            public List<int>? ServiceIds { get; set; }
        }
    }
}
