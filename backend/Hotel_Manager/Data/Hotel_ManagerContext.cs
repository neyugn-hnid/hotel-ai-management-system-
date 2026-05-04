using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Hotel_Manager.Modal;

namespace Hotel_Manager.Data
{
    public class Hotel_ManagerContext : DbContext
    {
        public Hotel_ManagerContext (DbContextOptions<Hotel_ManagerContext> options)
            : base(options)
        {
        }

        public DbSet<Hotel_Manager.Modal.Room> Room { get; set; } = default!;
        public DbSet<RoomImage> RoomImages { get; set; }
        public DbSet<Hotel_Manager.Modal.Service> Service { get; set; } = default!;
        public DbSet<Hotel_Manager.Modal.Customer> Customer { get; set; } = default!;
        public DbSet<Hotel_Manager.Modal.BookingService> BookingService { get; set; } = default!;
        public DbSet<Hotel_Manager.Modal.Invoice> Invoice { get; set; } = default!;
        public DbSet<Hotel_Manager.Modal.Booking> Booking { get; set; } = default!;
        public DbSet<Hotel_Manager.Modal.Account> Account { get; set; } = default!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Invoice>()
                .HasOne(i => i.Customer)
                .WithMany(c => c.Invoices)
                .HasForeignKey(i => i.CustomerId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Invoice>()
                .HasOne(i => i.Booking)
                .WithMany(b => b.Invoices)
                .HasForeignKey(i => i.BookingId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Invoice>()
                .HasOne(i => i.Account)
                .WithMany(a => a.Invoices)
                .HasForeignKey(i => i.AccountId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
