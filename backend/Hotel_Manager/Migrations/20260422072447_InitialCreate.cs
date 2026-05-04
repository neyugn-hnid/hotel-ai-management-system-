using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hotel_Manager.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "accounts",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    full_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    email = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    password_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    role = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    avatar_color = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    last_login_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_accounts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "customers",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    full_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    email = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    phone_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    identity_card = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    loyalty_tier = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ai_preferences = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "rooms",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    room_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    card_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    room_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    price_per_night = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    features = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rooms", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "services",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    service_name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    price = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_services", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "bookings",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    booking_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    customer_id = table.Column<int>(type: "int", nullable: false),
                    room_id = table.Column<int>(type: "int", nullable: false),
                    account_id = table.Column<int>(type: "int", nullable: true),
                    check_in_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    check_out_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ai_match_score = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    total_room_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bookings", x => x.id);
                    table.ForeignKey(
                        name: "FK_bookings_accounts_account_id",
                        column: x => x.account_id,
                        principalTable: "accounts",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_bookings_customers_customer_id",
                        column: x => x.customer_id,
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bookings_rooms_room_id",
                        column: x => x.room_id,
                        principalTable: "rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "booking_services",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    booking_id = table.Column<int>(type: "int", nullable: false),
                    service_id = table.Column<int>(type: "int", nullable: false),
                    quantity = table.Column<int>(type: "int", nullable: false),
                    unit_price = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    total_price = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    provided_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_booking_services", x => x.id);
                    table.ForeignKey(
                        name: "FK_booking_services_bookings_booking_id",
                        column: x => x.booking_id,
                        principalTable: "bookings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_booking_services_services_service_id",
                        column: x => x.service_id,
                        principalTable: "services",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoices",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    invoice_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    booking_id = table.Column<int>(type: "int", nullable: false),
                    customer_id = table.Column<int>(type: "int", nullable: false),
                    account_id = table.Column<int>(type: "int", nullable: true),
                    subtotal_room = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    subtotal_services = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    tax_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    discount_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    total_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    payment_method = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    payment_status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    issued_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    BookingId1 = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invoices", x => x.id);
                    table.ForeignKey(
                        name: "FK_invoices_accounts_account_id",
                        column: x => x.account_id,
                        principalTable: "accounts",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_invoices_bookings_BookingId1",
                        column: x => x.BookingId1,
                        principalTable: "bookings",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_invoices_bookings_booking_id",
                        column: x => x.booking_id,
                        principalTable: "bookings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_invoices_customers_customer_id",
                        column: x => x.customer_id,
                        principalTable: "customers",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_booking_services_booking_id",
                table: "booking_services",
                column: "booking_id");

            migrationBuilder.CreateIndex(
                name: "IX_booking_services_service_id",
                table: "booking_services",
                column: "service_id");

            migrationBuilder.CreateIndex(
                name: "IX_bookings_account_id",
                table: "bookings",
                column: "account_id");

            migrationBuilder.CreateIndex(
                name: "IX_bookings_customer_id",
                table: "bookings",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "IX_bookings_room_id",
                table: "bookings",
                column: "room_id");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_account_id",
                table: "invoices",
                column: "account_id");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_booking_id",
                table: "invoices",
                column: "booking_id");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_BookingId1",
                table: "invoices",
                column: "BookingId1",
                unique: true,
                filter: "[BookingId1] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_customer_id",
                table: "invoices",
                column: "customer_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "booking_services");

            migrationBuilder.DropTable(
                name: "invoices");

            migrationBuilder.DropTable(
                name: "services");

            migrationBuilder.DropTable(
                name: "bookings");

            migrationBuilder.DropTable(
                name: "accounts");

            migrationBuilder.DropTable(
                name: "customers");

            migrationBuilder.DropTable(
                name: "rooms");
        }
    }
}
