using Hotel_Manager.Data;
using Hotel_Manager.Hubs;
using Hotel_Manager.Services.Auth;
using Hotel_Manager.Services.BookingAi;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<Hotel_ManagerContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Hotel_ManagerContext") ?? throw new InvalidOperationException("Connection string 'Hotel_ManagerContext' not found.")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy
                .WithOrigins("http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5501", "http://localhost:5501")
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/bookingHub"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true,

        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],

        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])
        ),
        
        // Map claim types correctly for role-based authorization
        NameClaimType = ClaimTypes.Name,
        RoleClaimType = ClaimTypes.Role
    };
});
builder.Services.AddAuthorization();

builder.Services.Configure<BookingAiOptions>(builder.Configuration.GetSection("BookingAI"));
builder.Services.AddHttpClient<IOllamaReasoningClient, OllamaReasoningClient>((serviceProvider, client) =>
{
    var options = serviceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<BookingAiOptions>>().Value;
    client.BaseAddress = new Uri(options.OllamaBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(Math.Max(2, options.LlmTimeoutSeconds));
});
builder.Services.AddHttpClient<IGoogleGeminiReasoningClient, GoogleGeminiReasoningClient>();
builder.Services.AddHttpClient<IDeepSeekReasoningClient, DeepSeekReasoningClient>((serviceProvider, client) =>
{
    var options = serviceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<BookingAiOptions>>().Value;
    client.BaseAddress = new Uri(options.DeepSeekBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(Math.Max(2, options.LlmTimeoutSeconds));
});
builder.Services.AddScoped<IBookingRecommendationService, BookingRecommendationService>();
builder.Services.AddSingleton<IRefreshTokenStore, InMemoryRefreshTokenStore>();

builder.Services.AddControllers();
builder.Services.AddSignalR();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<BookingHub>("/bookingHub");

app.Run();
