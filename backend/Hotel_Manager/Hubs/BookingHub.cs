using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Hotel_Manager.Hubs
{
    [Authorize(Roles = "Admin,Lễ tân")]
    public class BookingHub : Hub
    {
    }
}
