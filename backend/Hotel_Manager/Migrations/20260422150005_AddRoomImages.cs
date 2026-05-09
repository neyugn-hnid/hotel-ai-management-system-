using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hotel_Manager.Migrations
{
    
    public partial class AddRoomImages : Migration
    {
        
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "features",
                table: "rooms");

            migrationBuilder.DropColumn(
                name: "room_number",
                table: "rooms");

            migrationBuilder.RenameColumn(
                name: "card_name",
                table: "rooms",
                newName: "name");

            migrationBuilder.CreateTable(
                name: "room_images",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    room_id = table.Column<int>(type: "int", nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_room_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_room_images_rooms_room_id",
                        column: x => x.room_id,
                        principalTable: "rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_room_images_room_id",
                table: "room_images",
                column: "room_id");
        }

        
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "room_images");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "rooms",
                newName: "card_name");

            migrationBuilder.AddColumn<string>(
                name: "features",
                table: "rooms",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "room_number",
                table: "rooms",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");
        }
    }
}
