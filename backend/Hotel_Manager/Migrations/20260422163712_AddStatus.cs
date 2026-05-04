using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hotel_Manager.Migrations
{
    /// <inheritdoc />
    public partial class AddStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "loyalty_tier",
                table: "customers");

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "customers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "status",
                table: "customers");

            migrationBuilder.AddColumn<string>(
                name: "loyalty_tier",
                table: "customers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");
        }
    }
}
