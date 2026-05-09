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
    public class CustomersController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;

        public CustomersController(Hotel_ManagerContext context)
        {
            _context = context;
        }

        
        [HttpGet]
        [Authorize(Roles = "Admin,Lễ tân")]
        public ActionResult<object> GetCustomer(
            [FromQuery] string? q,
            [FromQuery] string? status,
            [FromQuery] string? sortBy = "updatedAt",
            [FromQuery] string? sortDir = "desc",
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            pageNumber = pageNumber < 1 ? 1 : pageNumber;
            pageSize = pageSize < 1 ? 10 : pageSize;
            pageSize = pageSize > 100 ? 100 : pageSize;

            IQueryable<Customer> query = _context.Customer.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(q))
            {
                string keyword = q.Trim().ToLower();
                query = query.Where(c =>
                    (c.FullName != null && c.FullName.ToLower().Contains(keyword)) ||
                    (c.IdentityCard != null && c.IdentityCard.ToLower().Contains(keyword)) ||
                    (c.PhoneNumber != null && c.PhoneNumber.ToLower().Contains(keyword)) ||
                    (c.Email != null && c.Email.ToLower().Contains(keyword))
                );
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                string statusFilter = status.Trim().ToLower();
                query = query.Where(c => c.Status != null && c.Status.ToLower() == statusFilter);
            }

            string normalizedSortBy = (sortBy ?? "updatedAt").Trim().ToLower();
            bool isAsc = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);

            query = normalizedSortBy switch
            {
                "name" => isAsc ? query.OrderBy(c => c.FullName) : query.OrderByDescending(c => c.FullName),
                "status" => isAsc ? query.OrderBy(c => c.Status) : query.OrderByDescending(c => c.Status),
                "createdat" => isAsc ? query.OrderBy(c => c.CreatedAt) : query.OrderByDescending(c => c.CreatedAt),
                _ => isAsc ? query.OrderBy(c => c.UpdatedAt) : query.OrderByDescending(c => c.UpdatedAt),
            };

            int totalCount = query.Count();
            List<Customer> pageItems = query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            IPagedList<Customer> paged = new StaticPagedList<Customer>(
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
            [Authorize(Roles = "Admin,Lễ tân")]
        [Authorize(Roles = "Admin,Lễ tân")]
        public async Task<ActionResult<Customer>> GetCustomer(int id)
        {
            var customer = await _context.Customer.FindAsync(id);

            if (customer == null)
            {
                return NotFound();
            }

            return customer;
        }

        [HttpGet("public/by-phone")]
        [AllowAnonymous]
        public async Task<ActionResult<Customer>> GetCustomerByPhone([FromQuery] string? phone)
        {
            var normalizedPhone = NormalizePhone(phone);
            if (string.IsNullOrWhiteSpace(normalizedPhone))
            {
                return BadRequest(new { message = "Số điện thoại không hợp lệ" });
            }

            var customer = (await _context.Customer
                .AsNoTracking()
                .ToListAsync())
                .FirstOrDefault(c => NormalizePhone(c.PhoneNumber) == normalizedPhone);

            if (customer == null)
            {
                return NotFound(new { message = "Không tìm thấy khách hàng" });
            }

            return Ok(customer);
        }

        
        
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Lễ tân")]
        public async Task<IActionResult> PutCustomer(int id, Customer customer)
        {
            if (id != customer.Id)
            {
                return BadRequest();
            }

            _context.Entry(customer).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CustomerExists(id))
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
        public async Task<ActionResult<Customer>> PostCustomer(Customer customer)
        {
            var normalizedPhone = NormalizePhone(customer.PhoneNumber);
            if (!string.IsNullOrWhiteSpace(normalizedPhone))
            {
                var existingCustomer = (await _context.Customer
                    .AsNoTracking()
                    .ToListAsync())
                    .FirstOrDefault(c => NormalizePhone(c.PhoneNumber) == normalizedPhone);

                if (existingCustomer != null)
                {
                    return Ok(existingCustomer);
                }
            }

            _context.Customer.Add(customer);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetCustomer", new { id = customer.Id }, customer);
        }

        
        [HttpDelete("{id}")]
            [Authorize(Roles = "Admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteCustomer(int id)
        {
            var customer = await _context.Customer.FindAsync(id);
            if (customer == null)
            {
                return NotFound();
            }

            _context.Customer.Remove(customer);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool CustomerExists(int id)
        {
            return _context.Customer.Any(e => e.Id == id);
        }

        private static string NormalizePhone(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone))
            {
                return string.Empty;
            }

            return new string(phone.Where(char.IsDigit).ToArray());
        }
    }
}
