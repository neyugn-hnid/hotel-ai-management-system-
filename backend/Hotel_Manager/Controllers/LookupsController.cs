using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_Manager.Data;

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,Receptionist")]
    public class LookupsController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;

        public LookupsController(Hotel_ManagerContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<LookupData>> GetAll()
        {
            var roomTypes = await _context.Room
                .AsNoTracking()
                .Select(r => r.RoomType)
                .Where(t => t != null)
                .Distinct()
                .OrderBy(t => t)
                .ToListAsync();

            var roomStatuses = await _context.Room
                .AsNoTracking()
                .Select(r => r.Status)
                .Where(s => s != null)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            var customerStatuses = await _context.Customer
                .AsNoTracking()
                .Select(c => c.Status)
                .Where(s => s != null)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            var serviceCategories = await _context.Service
                .AsNoTracking()
                .Select(s => s.Category)
                .Where(c => c != null)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            var serviceStatuses = await _context.Service
                .AsNoTracking()
                .Select(s => s.Status)
                .Where(st => st != null)
                .Distinct()
                .OrderBy(st => st)
                .ToListAsync();

            var accountRoles = await _context.Account
                .AsNoTracking()
                .Select(a => a.Role)
                .Where(r => r != null)
                .Distinct()
                .OrderBy(r => r)
                .ToListAsync();

            accountRoles = accountRoles
                .Select(NormalizeAccountRole)
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Distinct()
                .OrderBy(r => r)
                .ToList();

            var accountStatuses = await _context.Account
                .AsNoTracking()
                .Select(a => a.Status)
                .Where(s => s != null)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            var bookingStatuses = await _context.Booking
                .AsNoTracking()
                .Select(b => b.Status)
                .Where(s => s != null)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            return Ok(new LookupData
            {
                RoomTypes = roomTypes!,
                RoomStatuses = roomStatuses!,
                CustomerStatuses = customerStatuses!,
                ServiceCategories = serviceCategories!,
                ServiceStatuses = serviceStatuses!,
                AccountRoles = accountRoles!,
                AccountStatuses = accountStatuses!,
                BookingStatuses = bookingStatuses!
            });
        }

        private static string NormalizeAccountRole(string? role)
        {
            var normalized = (role ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return string.Empty;
            }

            var compact = normalized
                .Normalize(System.Text.NormalizationForm.FormD)
                .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
                .Select(c => c == 'đ' ? 'd' : c == 'Đ' ? 'D' : c)
                .ToArray();

            var key = new string(compact)
                .Normalize(System.Text.NormalizationForm.FormC)
                .ToLowerInvariant()
                .Replace(" ", string.Empty);

            if (key == "admin")
            {
                return "Admin";
            }

            if (key == "letan" || key == "receptionist" || key == "staff" || key == "employee" || key == "nhanvien")
            {
                return "Receptionist";
            }

            if (key == "khach" || key == "customer" || key == "guest")
            {
                return "Customer";
            }

            return normalized;
        }
    }

    public class LookupData
    {
        public List<string> RoomTypes { get; set; } = new();
        public List<string> RoomStatuses { get; set; } = new();
        public List<string> CustomerStatuses { get; set; } = new();
        public List<string> ServiceCategories { get; set; } = new();
        public List<string> ServiceStatuses { get; set; } = new();
        public List<string> AccountRoles { get; set; } = new();
        public List<string> AccountStatuses { get; set; } = new();
        public List<string> BookingStatuses { get; set; } = new();
    }
}
