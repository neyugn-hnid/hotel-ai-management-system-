using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_Manager.Data;
using Hotel_Manager.Modal;

namespace Hotel_Manager.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,Receptionist")]
    public class DashboardController : ControllerBase
    {
        private readonly Hotel_ManagerContext _context;

        public DashboardController(Hotel_ManagerContext context)
        {
            _context = context;
        }

        
        [HttpGet("summary")]
        public async Task<ActionResult<DashboardSummary>> GetSummary()
        {
            var today = DateTime.UtcNow.Date;
            var sevenDaysAgo = today.AddDays(-6);

            
            var roomStats = await _context.Room
                .GroupBy(r => 1)
                .Select(g => new
                {
                    Total = g.Count(),
                    Occupied = g.Count(r => r.Status == "Đang sử dụng"),
                    Booked = g.Count(r => r.Status == "Đã đặt"),
                    Available = g.Count(r => r.Status == "Trống"),
                    Cleaning = g.Count(r => r.Status == "Đang dọn dẹp"),
                    Maintenance = g.Count(r => r.Status == "Bảo trì")
                })
                .FirstOrDefaultAsync();

            int totalRooms = roomStats?.Total ?? 0;
            int occupiedRooms = roomStats?.Occupied ?? 0;
            int bookedRooms = roomStats?.Booked ?? 0;
            int availableRooms = roomStats?.Available ?? 0;
            int cleaningRooms = roomStats?.Cleaning ?? 0;
            int maintenanceRooms = roomStats?.Maintenance ?? 0;

            double occupancyRate = totalRooms > 0
                ? Math.Round((double)(occupiedRooms + bookedRooms) / totalRooms * 100, 1)
                : 0;

            
            
            
            
            

            
            var guestsStaying = await _context.Booking
                .CountAsync(b => b.Status == "Đang ở" || b.Status == "Check-in");

            
            var newBookingsToday = await _context.Booking
                .CountAsync(b => b.CreatedAt >= today);

            
            var yesterday = today.AddDays(-1);
            var yesterdayBookings = await _context.Booking
                .CountAsync(b => b.CreatedAt >= yesterday && b.CreatedAt < today);
            int bookingTrend = newBookingsToday - yesterdayBookings;

            
            var dailyStats = new List<DailyStats>();
            for (int i = 6; i >= 0; i--)
            {
                var dayStart = today.AddDays(-i);
                var dayEnd = dayStart.AddDays(1);

                var dayBookings = await _context.Booking
                    .Where(b => b.CreatedAt >= dayStart && b.CreatedAt < dayEnd)
                    .ToListAsync();

                var dayRevenue = dayBookings.Sum(b => b.TotalRoomAmount);
                var dayBookingCount = dayBookings.Count;

                
                var dayGuests = await _context.Booking
                    .Where(b => b.CheckInDate <= dayEnd && b.CheckOutDate >= dayStart
                        && (b.Status == "Đang ở" || b.Status == "Check-in" || b.Status == "Check-out"))
                    .CountAsync();

                dailyStats.Add(new DailyStats
                {
                    Date = dayStart.ToString("dd/MM"),
                    Revenue = dayRevenue,
                    Bookings = dayBookingCount,
                    Guests = dayGuests
                });
            }

            
            var occupancyTrend = new List<double>();
            for (int i = 6; i >= 0; i--)
            {
                var dayStart = today.AddDays(-i);
                var dayEnd = dayStart.AddDays(1);

                var activeBookings = await _context.Booking
                    .Where(b => b.CheckInDate <= dayEnd && b.CheckOutDate >= dayStart
                        && (b.Status == "Đang ở" || b.Status == "Check-in" || b.Status == "Đã xác nhận"))
                    .Select(b => b.RoomId)
                    .Distinct()
                    .CountAsync();

                double rate = totalRooms > 0 ? Math.Round((double)activeBookings / totalRooms * 100, 1) : 0;
                occupancyTrend.Add(rate);
            }

            
            var recentBookings = await _context.Booking
                .Include(b => b.Customer)
                .Include(b => b.Room)
                .OrderByDescending(b => b.UpdatedAt)
                .Take(15)
                .Select(b => new RecentActivityItem
                {
                    BookingId = b.Id,
                    GuestName = b.Customer != null ? b.Customer.FullName : "Khách vãng lai",
                    GuestInitials = GetInitials(b.Customer != null ? b.Customer.FullName : "K"),
                    RoomName = b.Room != null ? b.Room.CardName : "N/A",
                    RoomType = b.Room != null ? b.Room.RoomType : "",
                    Status = b.Status ?? "",
                    Amount = b.TotalRoomAmount,
                    Nights = b.CheckOutDate > b.CheckInDate
                        ? (int)(b.CheckOutDate - b.CheckInDate).TotalDays
                        : 1,
                    TimeAgo = GetRelativeTime(b.UpdatedAt ?? b.CreatedAt)
                })
                .ToListAsync();

            return Ok(new DashboardSummary
            {
                TotalRooms = totalRooms,
                OccupiedRooms = occupiedRooms,
                BookedRooms = bookedRooms,
                AvailableRooms = availableRooms,
                CleaningRooms = cleaningRooms,
                MaintenanceRooms = maintenanceRooms,
                OccupancyRate = occupancyRate,
                GuestsStaying = guestsStaying,
                NewBookingsToday = newBookingsToday,
                BookingTrend = bookingTrend,
                DailyStats = dailyStats,
                OccupancyTrend = occupancyTrend,
                RecentActivities = recentBookings
            });
        }

        private static string GetInitials(string fullName)
        {
            if (string.IsNullOrWhiteSpace(fullName)) return "?";
            var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 1)
                return parts[0].Substring(0, Math.Min(2, parts[0].Length)).ToUpper();
            return (parts[0].Substring(0, 1) + parts[^1].Substring(0, 1)).ToUpper();
        }

        private static string GetRelativeTime(DateTime? dateTime)
        {
            if (dateTime == null) return "";

            var now = DateTime.UtcNow;
            var span = now - dateTime.Value;

            if (span.TotalMinutes < 1) return "Vừa xong";
            if (span.TotalMinutes < 60) return $"{(int)span.TotalMinutes} phút trước";
            if (span.TotalHours < 24) return $"{(int)span.TotalHours} giờ trước";
            if (span.TotalDays < 2) return "Hôm qua";
            if (span.TotalDays < 7) return $"{(int)span.TotalDays} ngày trước";
            return dateTime.Value.ToLocalTime().ToString("dd/MM/yyyy");
        }
    }

    public class DashboardSummary
    {
        public int TotalRooms { get; set; }
        public int OccupiedRooms { get; set; }
        public int BookedRooms { get; set; }
        public int AvailableRooms { get; set; }
        public int CleaningRooms { get; set; }
        public int MaintenanceRooms { get; set; }
        public double OccupancyRate { get; set; }
        public decimal AvgRevenuePerRoom { get; set; }
        public int GuestsStaying { get; set; }
        public int NewBookingsToday { get; set; }
        public int BookingTrend { get; set; }
        public List<DailyStats> DailyStats { get; set; } = new();
        public List<double> OccupancyTrend { get; set; } = new();
        public List<RecentActivityItem> RecentActivities { get; set; } = new();
    }

    public class DailyStats
    {
        public string Date { get; set; } = "";
        public decimal Revenue { get; set; }
        public int Bookings { get; set; }
        public int Guests { get; set; }
    }

    public class RecentActivityItem
    {
        public int BookingId { get; set; }
        public string GuestName { get; set; } = "";
        public string GuestInitials { get; set; } = "";
        public string RoomName { get; set; } = "";
        public string RoomType { get; set; } = "";
        public string Status { get; set; } = "";
        public decimal Amount { get; set; }
        public int Nights { get; set; }
        public string TimeAgo { get; set; } = "";
    }
}
