using Azure.Core;
using Hotel_Manager.Data;
using Hotel_Manager.Modal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.DotNet.Scaffolding.Shared.Messaging;
using Microsoft.EntityFrameworkCore;
using NuGet.Protocol.Plugins;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using X.PagedList;

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountsController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;

        public AccountsController(Hotel_ManagerContext context)
        {
            _context = context;
        }

        // GET: api/Accounts
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public ActionResult<object> GetAccount(
            [FromQuery] string? q,
            [FromQuery] string? role,
            [FromQuery] string? status,
            [FromQuery] string? sortBy = "updatedAt",
            [FromQuery] string? sortDir = "desc",
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            pageNumber = pageNumber < 1 ? 1 : pageNumber;
            pageSize = pageSize < 1 ? 10 : pageSize;
            pageSize = pageSize > 100 ? 100 : pageSize;

            IQueryable<Account> query = _context.Account.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(q))
            {
                string keyword = q.Trim().ToLower();
                query = query.Where(a =>
                    (a.FullName != null && a.FullName.ToLower().Contains(keyword)) ||
                    (a.Email != null && a.Email.ToLower().Contains(keyword))
                );
            }

            if (!string.IsNullOrWhiteSpace(role))
            {
                string roleFilter = role.Trim().ToLower();
                query = query.Where(a => a.Role != null && a.Role.ToLower() == roleFilter);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                string statusFilter = status.Trim().ToLower();
                query = query.Where(a => a.Status != null && a.Status.ToLower() == statusFilter);
            }

            string normalizedSortBy = (sortBy ?? "updatedAt").Trim().ToLower();
            bool isAsc = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);

            query = normalizedSortBy switch
            {
                "name" => isAsc ? query.OrderBy(a => a.FullName) : query.OrderByDescending(a => a.FullName),
                "role" => isAsc ? query.OrderBy(a => a.Role) : query.OrderByDescending(a => a.Role),
                "status" => isAsc ? query.OrderBy(a => a.Status) : query.OrderByDescending(a => a.Status),
                "lastloginat" => isAsc ? query.OrderBy(a => a.LastLoginAt) : query.OrderByDescending(a => a.LastLoginAt),
                "createdat" => isAsc ? query.OrderBy(a => a.CreatedAt) : query.OrderByDescending(a => a.CreatedAt),
                _ => isAsc ? query.OrderBy(a => a.UpdatedAt) : query.OrderByDescending(a => a.UpdatedAt),
            };

            int totalCount = query.Count();
            List<Account> pageItems = query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            IPagedList<Account> paged = new StaticPagedList<Account>(
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

        // GET: api/Accounts/5
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Account>> GetAccount(int id)
        {
            var account = await _context.Account.FindAsync(id);

            if (account == null)
            {
                return NotFound();
            }

            return account;
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<object>> GetMyAccount()
        {
            var accountIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (!int.TryParse(accountIdClaim, out var accountId))
            {
                return Unauthorized(new { message = "Không xác định được tài khoản hiện tại" });
            }

            var account = await _context.Account
                .AsNoTracking()
                .Where(a => a.Id == accountId)
                .Select(a => new
                {
                    a.Id,
                    a.FullName,
                    a.Email,
                    a.PhoneNumber,
                    a.Role,
                    a.Status,
                    a.AvatarColor,
                    a.LastLoginAt,
                    a.CreatedAt,
                    a.UpdatedAt
                })
                .FirstOrDefaultAsync();

            if (account == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản" });
            }

            return Ok(account);
        }

        // PUT: api/Accounts/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> PutAccount(int id, UpdateAccountRequest request)
        {
            var account = await _context.Account.FindAsync(id);

            if (account == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản" });
            }

            account.FullName = request.FullName;
            account.Email = request.Email;
            account.PhoneNumber = request.PhoneNumber;
            account.Role = request.Role;
            account.Status = request.Status;

            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return StatusCode(500, new { message = "Lỗi cập nhật dữ liệu" });
            }

            return Ok(new{ message = "Cập nhật tài khoản thành công" });
        }

        [HttpPut("me")]
        [Authorize]
        public async Task<IActionResult> PutMyAccount(UpdateSelfAccountRequest request)
        {
            var accountIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (!int.TryParse(accountIdClaim, out var accountId))
            {
                return Unauthorized(new { message = "Không xác định được tài khoản hiện tại" });
            }

            var account = await _context.Account.FindAsync(accountId);
            if (account == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản" });
            }

            if (string.IsNullOrWhiteSpace(request.FullName))
            {
                return BadRequest(new { message = "Họ và tên không được để trống" });
            }

            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { message = "Email không được để trống" });
            }

            var normalizedEmail = request.Email.Trim();
            var emailChanged = !string.Equals(account.Email, normalizedEmail, StringComparison.OrdinalIgnoreCase);
            var passwordChanged = !string.IsNullOrWhiteSpace(request.NewPassword);

            if (emailChanged || passwordChanged)
            {
                if (string.IsNullOrWhiteSpace(request.CurrentPassword))
                {
                    return BadRequest(new { message = "Vui lòng nhập mật khẩu hiện tại" });
                }

                if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, account.PasswordHash))
                {
                    return Unauthorized(new { message = "Mật khẩu hiện tại không đúng" });
                }
            }

            if (emailChanged)
            {
                var emailExists = await _context.Account.AnyAsync(a => a.Id != accountId && a.Email == normalizedEmail);
                if (emailExists)
                {
                    return BadRequest(new { message = "Email đã tồn tại, vui lòng sử dụng email khác" });
                }
            }

            if (passwordChanged)
            {
                if (string.IsNullOrWhiteSpace(request.ConfirmPassword))
                {
                    return BadRequest(new { message = "Vui lòng xác nhận mật khẩu mới" });
                }

                if (!string.Equals(request.NewPassword, request.ConfirmPassword, StringComparison.Ordinal))
                {
                    return BadRequest(new { message = "Mật khẩu mới không khớp" });
                }

                if (request.NewPassword.Length < 6)
                {
                    return BadRequest(new { message = "Mật khẩu mới phải có ít nhất 6 ký tự" });
                }

                account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            }

            account.FullName = request.FullName.Trim();
            account.Email = normalizedEmail;
            account.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
            account.UpdatedAt = DateTime.UtcNow;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return StatusCode(500, new { message = "Lỗi cập nhật dữ liệu" });
            }

            return Ok(new
            {
                message = "Cập nhật tài khoản thành công",
                account = new
                {
                    account.Id,
                    account.FullName,
                    account.Email,
                    account.PhoneNumber,
                    account.Role,
                    account.Status,
                    account.AvatarColor,
                    account.LastLoginAt,
                    account.CreatedAt,
                    account.UpdatedAt
                }
            });
        }

        // POST: api/Accounts
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Account>> PostAccount(CreateAccountRequest request)
        {
            var acc = new Account
            {
                FullName = request.FullName,
                Email = request.Email,
                PhoneNumber = request.PhoneNumber,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                Status = request.Status

            };

            _context.Account.Add(acc);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Thêm tài khoản thành công"});
        }

        // DELETE: api/Accounts/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteAccount(int id)
        {
            var account = await _context.Account.FindAsync(id);
            if (account == null)
            {
                return NotFound();
            }

            _context.Account.Remove(account);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPatch("{id}/toggle-status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateStatus(int id)
        {
            var account = await _context.Account.FindAsync(id);

            if (account == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản" });
            }

            // 🔥 Toggle trạng thái
            account.Status = account.Status == "Hoạt động" ? "Khóa" : "Hoạt động";
            account.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Cập nhật trạng thái thành công"
            });
        }

        private bool AccountExists(int id)
        {
            return _context.Account.Any(e => e.Id == id);
        }

        public class CreateAccountRequest
        {
            public string? FullName { get; set; }
            public string? Email { get; set; }
            public string? PhoneNumber { get; set; }
            public string? Password { get; set; }
            public string? Role { get; set; }
            public string? Status { get; set; }

        }

        public class UpdateAccountRequest
        {
            public string? FullName { get; set; }
            public string? Email { get; set; }
            public string? PhoneNumber { get; set; }
            public string? Password { get; set; }
            public string? Role { get; set; }
            public string? Status { get; set; }
        }

        public class UpdateSelfAccountRequest
        {
            public string? FullName { get; set; }
            public string? Email { get; set; }
            public string? PhoneNumber { get; set; }
            public string? CurrentPassword { get; set; }
            public string? NewPassword { get; set; }
            public string? ConfirmPassword { get; set; }
        }

       
    }
}
