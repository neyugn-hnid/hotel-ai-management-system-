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
        public async Task<ActionResult<IEnumerable<Invoice>>> GetInvoice()
        {
            return await _context.Invoice.ToListAsync();
        }

        
        [HttpGet("{id}")]
        public async Task<ActionResult<Invoice>> GetInvoice(int id)
        {
            var invoice = await _context.Invoice.FindAsync(id);

            if (invoice == null)
            {
                return NotFound();
            }

            return invoice;
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
        }
    }
}
