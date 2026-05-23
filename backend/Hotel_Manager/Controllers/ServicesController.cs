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
    public class ServicesController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;

        public ServicesController(Hotel_ManagerContext context)
        {
            _context = context;
        }

        
        [HttpGet]
        [Authorize(Roles = "Admin,Receptionist")]
        public ActionResult<object> GetService(
            [FromQuery] string? q,
            [FromQuery] string? category,
            [FromQuery] string? status,
            [FromQuery] string? sortBy = "updatedAt",
            [FromQuery] string? sortDir = "desc",
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            pageNumber = pageNumber < 1 ? 1 : pageNumber;
            pageSize = pageSize < 1 ? 10 : pageSize;
            pageSize = pageSize > 100 ? 100 : pageSize;

            IQueryable<Service> query = _context.Service.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(q))
            {
                string keyword = q.Trim().ToLower();
                query = query.Where(s =>
                    (s.ServiceName != null && s.ServiceName.ToLower().Contains(keyword)) ||
                    (s.Description != null && s.Description.ToLower().Contains(keyword))
                );
            }

            if (!string.IsNullOrWhiteSpace(category))
            {
                string categoryFilter = category.Trim().ToLower();
                query = query.Where(s => s.Category != null && s.Category.ToLower() == categoryFilter);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                string statusFilter = status.Trim().ToLower();
                query = query.Where(s => s.Status != null && s.Status.ToLower() == statusFilter);
            }

            string normalizedSortBy = (sortBy ?? "updatedAt").Trim().ToLower();
            bool isAsc = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);

            query = normalizedSortBy switch
            {
                "name" => isAsc ? query.OrderBy(s => s.ServiceName) : query.OrderByDescending(s => s.ServiceName),
                "price" => isAsc ? query.OrderBy(s => s.Price) : query.OrderByDescending(s => s.Price),
                "category" => isAsc ? query.OrderBy(s => s.Category) : query.OrderByDescending(s => s.Category),
                "status" => isAsc ? query.OrderBy(s => s.Status) : query.OrderByDescending(s => s.Status),
                "createdat" => isAsc ? query.OrderBy(s => s.CreatedAt) : query.OrderByDescending(s => s.CreatedAt),
                _ => isAsc ? query.OrderBy(s => s.UpdatedAt) : query.OrderByDescending(s => s.UpdatedAt),
            };

            int totalCount = query.Count();
            List<Service> pageItems = query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            IPagedList<Service> paged = new StaticPagedList<Service>(
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
        [Authorize(Roles = "Admin,Receptionist")]
        public async Task<ActionResult<Service>> GetService(int id)
        {
            var service = await _context.Service.FindAsync(id);

            if (service == null)
            {
                return NotFound();
            }

            return service;
        }

        
        
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> PutService(int id, UpsertServiceRequest request)
        {
            if (id != request.Id)
            {
                return BadRequest();
            }

            var service = await _context.Service.FindAsync(id);
            if (service == null)
            {
                return NotFound();
            }

            service.ServiceName = request.ServiceName?.Trim() ?? service.ServiceName;
            service.Category = request.Category?.Trim() ?? service.Category;
            service.Price = request.Price;
            service.Description = request.Description;
            service.Status = string.IsNullOrWhiteSpace(request.Status) ? service.Status : request.Status.Trim();
            service.UpdatedAt = DateTime.UtcNow;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ServiceExists(id))
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
        public async Task<ActionResult<Service>> PostService(UpsertServiceRequest request)
        {
            var service = new Service
            {
                ServiceName = request.ServiceName?.Trim() ?? string.Empty,
                Category = request.Category?.Trim() ?? string.Empty,
                Price = request.Price,
                Description = request.Description,
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Hoạt động" : request.Status.Trim(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Service.Add(service);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetService", new { id = service.Id }, service);
        }

        
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteService(int id)
        {
            var service = await _context.Service.FindAsync(id);
            if (service == null)
            {
                return NotFound();
            }

            _context.Service.Remove(service);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ServiceExists(int id)
        {
            return _context.Service.Any(e => e.Id == id);
        }

        public class UpsertServiceRequest
        {
            public int Id { get; set; }
            public string? ServiceName { get; set; }
            public string? Category { get; set; }
            public decimal Price { get; set; }
            public string? Description { get; set; }
            public string? Status { get; set; }
        }
    }
}
