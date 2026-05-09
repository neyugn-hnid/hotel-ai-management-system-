using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hotel_Manager.Migrations
{
    
    public partial class AddPhone : Migration
    {
        
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "phone_number",
                table: "accounts",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "phone_number",
                table: "accounts");
        }
    }
}
