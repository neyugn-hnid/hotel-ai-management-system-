using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_Manager.Data;
using Hotel_Manager.Modal;

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BookingServicesController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;

        public BookingServicesController(Hotel_ManagerContext context)
        {
            _context = context;
        }

        // GET: api/BookingServices
        [HttpGet]
        public async Task<ActionResult<IEnumerable<BookingService>>> GetBookingService()
        {
            return await _context.BookingService.ToListAsync();
        }

        // GET: api/BookingServices/5
        [HttpGet("{id}")]
        public async Task<ActionResult<BookingService>> GetBookingService(int id)
        {
            var bookingService = await _context.BookingService.FindAsync(id);

            if (bookingService == null)
            {
                return NotFound();
            }

            return bookingService;
        }

        // PUT: api/BookingServices/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutBookingService(int id, BookingService bookingService)
        {
            if (id != bookingService.Id)
            {
                return BadRequest();
            }

            _context.Entry(bookingService).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!BookingServiceExists(id))
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

        // POST: api/BookingServices
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<BookingService>> PostBookingService(BookingService bookingService)
        {
            _context.BookingService.Add(bookingService);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetBookingService", new { id = bookingService.Id }, bookingService);
        }

        // DELETE: api/BookingServices/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBookingService(int id)
        {
            var bookingService = await _context.BookingService.FindAsync(id);
            if (bookingService == null)
            {
                return NotFound();
            }

            _context.BookingService.Remove(bookingService);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool BookingServiceExists(int id)
        {
            return _context.BookingService.Any(e => e.Id == id);
        }
    }
}
