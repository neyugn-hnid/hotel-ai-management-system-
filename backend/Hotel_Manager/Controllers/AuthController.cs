using Hotel_Manager.Data;
using Hotel_Manager.Modal;
using Hotel_Manager.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;
        private readonly IConfiguration _configuration;
        private readonly IRefreshTokenStore _refreshTokenStore;

        public AuthController(Hotel_ManagerContext context, IConfiguration configuration, IRefreshTokenStore refreshTokenStore)
        {
            _context = context;
            _configuration = configuration;
            _refreshTokenStore = refreshTokenStore;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _context.Account.FirstOrDefaultAsync(a => a.Email == request.Email);
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { message = "Email hoặc mật khẩu không đúng" });
            }

            var accessToken = GenerateJwtToken(user);
            var refreshToken = _refreshTokenStore.IssueToken(user.Id, TimeSpan.FromDays(7));
            return Ok(new { token = accessToken, accessToken, refreshToken });
        }

        [Authorize]
        [HttpPost("logout")]
        public IActionResult Logout([FromBody] RefreshTokenRequest? request)
        {
            var accountIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(accountIdClaim, out var accountId) && accountId > 0)
            {
                _refreshTokenStore.RevokeAllForAccount(accountId);
            }

            if (request != null && !string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                _refreshTokenStore.Revoke(request.RefreshToken);
            }

            return Ok(new { message = "Đăng xuất thành công" });
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                return BadRequest(new { message = "Refresh token không hợp lệ" });
            }

            if (!_refreshTokenStore.TryGetAccountId(request.RefreshToken, out var accountId) || accountId <= 0)
            {
                return Unauthorized(new { message = "Refresh token đã hết hạn hoặc không hợp lệ" });
            }

            var user = await _context.Account.AsNoTracking().FirstOrDefaultAsync(a => a.Id == accountId);
            if (user == null)
            {
                _refreshTokenStore.Revoke(request.RefreshToken);
                return Unauthorized(new { message = "Không tìm thấy tài khoản" });
            }

            var accessToken = GenerateJwtToken(user);
            var newRefreshToken = _refreshTokenStore.IssueToken(user.Id, TimeSpan.FromDays(7));
            _refreshTokenStore.Revoke(request.RefreshToken);

            return Ok(new { token = accessToken, accessToken, refreshToken = newRefreshToken });
        }

        private string GenerateJwtToken(Account user)
        {
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim(ClaimTypes.Role, user.Role)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expires = DateTime.UtcNow.AddMinutes(30);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: expires,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (_context.Account.Any(a => a.Email == request.Email))
            {
                return BadRequest(new { message = "Email đã tồn tại, Vui lòng sử dụng email khác" });
            }

            var user = new Account
            {
                FullName = request.FullName,
                Email = request.Email,
                PhoneNumber = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = "Lễ tân",
                CreatedAt = DateTime.UtcNow
            };

            _context.Account.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đăng ký thành công" });
        }
    }



    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class RegisterRequest
    {
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Password { get; set; } = "";
    }

    public class RefreshTokenRequest
    {
        public string RefreshToken { get; set; } = string.Empty;
    }
}
