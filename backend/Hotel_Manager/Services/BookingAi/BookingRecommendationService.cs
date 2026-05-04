using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Hotel_Manager.Data;
using Hotel_Manager.Modal;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hotel_Manager.Services.BookingAi;

public interface IBookingRecommendationService
{
    Task<BookingAiRecommendResultDto> RecommendAsync(BookingAiRecommendRequestDto request, CancellationToken cancellationToken = default);
}

public class BookingAiOptions
{
    public string EngineMode { get; set; } = "hybrid";
    public bool EnableLlmReasoning { get; set; } = true;
    public string OllamaBaseUrl { get; set; } = "http://localhost:11434";
    public string OllamaModel { get; set; } = "gemma3:latest";
    public int LlmTimeoutSeconds { get; set; } = 8;
}

public interface IOllamaReasoningClient
{
    Task<string?> GenerateReasonAsync(string prompt, CancellationToken cancellationToken = default);
}

public class OllamaReasoningClient : IOllamaReasoningClient
{
    private readonly HttpClient _httpClient;
    private readonly BookingAiOptions _options;

    public OllamaReasoningClient(HttpClient httpClient, IOptions<BookingAiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<string?> GenerateReasonAsync(string prompt, CancellationToken cancellationToken = default)
    {
        if (!_options.EnableLlmReasoning)
        {
            return null;
        }

        var requestPayload = new
        {
            model = _options.OllamaModel,
            stream = false,
            messages = new[]
            {
                new { role = "system", content = "Ban la tro ly goi y phong cho khach san. Tra loi ngan gon bang tieng Viet, toi da 2 cau." },
                new { role = "user", content = prompt }
            },
            options = new
            {
                temperature = 0.2
            }
        };

        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(2, _options.LlmTimeoutSeconds)));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        using var response = await _httpClient.PostAsJsonAsync("/api/chat", requestPayload, linkedCts.Token);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(linkedCts.Token);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: linkedCts.Token);

        if (document.RootElement.TryGetProperty("message", out var messageElement)
            && messageElement.TryGetProperty("content", out var contentElement)
            && contentElement.ValueKind == JsonValueKind.String)
        {
            return contentElement.GetString();
        }

        if (document.RootElement.TryGetProperty("response", out var responseElement)
            && responseElement.ValueKind == JsonValueKind.String)
        {
            return responseElement.GetString();
        }

        return null;
    }
}

public class BookingRecommendationService : IBookingRecommendationService
{
    private readonly Hotel_ManagerContext _context;
    private readonly IOllamaReasoningClient _ollamaReasoningClient;
    private readonly BookingAiOptions _options;
    private readonly ILogger<BookingRecommendationService> _logger;

    public BookingRecommendationService(
        Hotel_ManagerContext context,
        IOllamaReasoningClient ollamaReasoningClient,
        IOptions<BookingAiOptions> options,
        ILogger<BookingRecommendationService> logger)
    {
        _context = context;
        _ollamaReasoningClient = ollamaReasoningClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<BookingAiRecommendResultDto> RecommendAsync(BookingAiRecommendRequestDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerQuery))
        {
            throw new ArgumentException("Thong tin khach hang khong hop le");
        }

        if (request.CheckInDate.HasValue && request.CheckOutDate.HasValue
            && request.CheckOutDate.Value.Date <= request.CheckInDate.Value.Date)
        {
            throw new ArgumentException("Ngay tra phong phai sau ngay nhan phong");
        }

        var allRooms = await _context.Room
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        if (allRooms.Count == 0)
        {
            throw new InvalidOperationException("Khong co du lieu phong de goi y");
        }

        string customerQuery = request.CustomerQuery.Trim().ToLower();
        Customer? matchedCustomer = await _context.Customer
            .AsNoTracking()
            .FirstOrDefaultAsync(c =>
                (c.IdentityCard != null && c.IdentityCard.ToLower() == customerQuery) ||
                (c.FullName != null && c.FullName.ToLower() == customerQuery) ||
                (c.PhoneNumber != null && c.PhoneNumber.ToLower() == customerQuery) ||
                (c.Email != null && c.Email.ToLower() == customerQuery),
                cancellationToken);

        List<string> promptTokens = Tokenize(request.AiPrompt);
        List<string> preferenceTokens = Tokenize(matchedCustomer?.AiPreferences);
        List<string> purposeTerms = PurposeKeywords(request.RoomPurpose);
        List<string> guestTerms = GuestKeywords(request.GuestCount ?? 2);
        DateTime? desiredCheckIn = request.CheckInDate?.Date;
        DateTime? desiredCheckOut = request.CheckOutDate?.Date;

        decimal budgetLimit = request.BudgetLimit.HasValue && request.BudgetLimit.Value > 0
            ? request.BudgetLimit.Value
            : 0;

        string seed = matchedCustomer?.IdentityCard
            ?? matchedCustomer?.FullName
            ?? request.CustomerQuery
            ?? "default";

        string[] cancelledStatuses = ["đã hủy", "da huy", "cancelled", "hủy"];

        var bookedRoomIds = desiredCheckIn.HasValue && desiredCheckOut.HasValue
            ? await _context.Booking
                .AsNoTracking()
                .Where(b =>
                    b.CheckInDate < desiredCheckOut.Value &&
                    b.CheckOutDate > desiredCheckIn.Value &&
                    (b.Status == null || !cancelledStatuses.Contains(b.Status.ToLower())))
                .Select(b => b.RoomId)
                .Distinct()
                .ToListAsync(cancellationToken)
            : new List<int>();

        var ranked = allRooms
            .Select(room => new
            {
                Room = room,
                Score = ScoreRoomCandidate(
                    room,
                    budgetLimit,
                    purposeTerms,
                    guestTerms,
                    promptTokens,
                    preferenceTokens,
                    seed,
                    request.GuestCount ?? 2,
                    CountNights(request.CheckInDate, request.CheckOutDate),
                    bookedRoomIds.Contains(room.Id))
            })
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .ToList();

        if (ranked.Count == 0)
        {
            throw new InvalidOperationException("Khong con phong phu hop trong khoang ngay va dieu kien da chon");
        }

        var best = ranked.First();
        string baseReason = BuildRecommendationReason(best.Room, budgetLimit, request.RoomPurpose, promptTokens.Count > 0, preferenceTokens.Count > 0, best.Score);

        string engine = "rule";
        string finalReason = baseReason;

        if (string.Equals(_options.EngineMode, "hybrid", StringComparison.OrdinalIgnoreCase) && _options.EnableLlmReasoning)
        {
            try
            {
                string prompt = BuildLlmPrompt(request, matchedCustomer, best.Room, best.Score, baseReason);
                string? llmReason = await _ollamaReasoningClient.GenerateReasonAsync(prompt, cancellationToken);
                if (!string.IsNullOrWhiteSpace(llmReason))
                {
                    finalReason = llmReason.Trim();
                    engine = "hybrid";
                }
                else
                {
                    engine = "hybrid-fallback";
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "LLM reasoning failed, fallback to rule-based reason");
                engine = "hybrid-fallback";
            }
        }

        return new BookingAiRecommendResultDto
        {
            Engine = engine,
            Customer = matchedCustomer == null
                ? null
                : new BookingAiCustomerDto
                {
                    Id = matchedCustomer.Id,
                    FullName = matchedCustomer.FullName,
                    Email = matchedCustomer.Email,
                    PhoneNumber = matchedCustomer.PhoneNumber,
                    IdentityCard = matchedCustomer.IdentityCard
                },
            Recommendation = new BookingAiRecommendationDto
            {
                RoomId = best.Room.Id,
                RoomName = best.Room.CardName,
                RoomType = best.Room.RoomType,
                PricePerNight = best.Room.PricePerNight,
                Status = best.Room.Status,
                MatchScore = best.Score,
                Reason = finalReason,
                ImageUrl = "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80"
            },
            TopRooms = ranked.Take(3)
                .Select(x => new BookingAiTopRoomDto
                {
                    RoomId = x.Room.Id,
                    RoomName = x.Room.CardName,
                    RoomType = x.Room.RoomType,
                    PricePerNight = x.Room.PricePerNight,
                    MatchScore = x.Score,
                    Status = x.Room.Status,
                    Reason = BuildRecommendationReason(x.Room, budgetLimit, request.RoomPurpose, promptTokens.Count > 0, preferenceTokens.Count > 0, x.Score)
                })
                .ToList()
        };
    }

    private static List<string> Tokenize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new List<string>();
        }

        return Regex.Split(text.ToLower(), "[^\\p{L}\\p{N}]+")
            .Where(token => !string.IsNullOrWhiteSpace(token) && token.Length >= 3)
            .Distinct()
            .ToList();
    }

    private static List<string> PurposeKeywords(string? roomPurpose)
    {
        string key = (roomPurpose ?? string.Empty).Trim().ToLower();
        return key switch
        {
            "business" => new List<string> { "executive", "business", "quiet", "work", "city", "desk", "meeting" },
            "honeymoon" => new List<string> { "suite", "penthouse", "ocean", "garden", "view", "private", "balcony", "romantic" },
            "family" => new List<string> { "family", "twin", "large", "connected", "kids", "spacious", "double" },
            _ => new List<string>()
        };
    }

    private static List<string> GuestKeywords(int guestCount)
    {
        if (guestCount >= 4)
        {
            return new List<string> { "family", "suite", "double", "connected", "large", "spacious", "twin" };
        }

        if (guestCount == 1)
        {
            return new List<string> { "single", "executive", "quiet", "compact" };
        }

        return new List<string> { "double", "queen", "king", "suite" };
    }

    private static bool ContainsAny(string source, IEnumerable<string> keywords)
    {
        foreach (string keyword in keywords)
        {
            if (!string.IsNullOrWhiteSpace(keyword) && source.Contains(keyword))
            {
                return true;
            }
        }

        return false;
    }

    private static int StableHash(string input)
    {
        unchecked
        {
            int hash = 17;
            foreach (char c in input)
            {
                hash = hash * 31 + c;
            }
            return Math.Abs(hash);
        }
    }

    private static int ScoreRoomCandidate(
        Room room,
        decimal budgetLimit,
        List<string> purposeTerms,
        List<string> guestTerms,
        List<string> promptTokens,
        List<string> preferenceTokens,
        string seed,
        int guestCount,
        int stayNights,
        bool isBookedInRequestedRange)
    {
        if (isBookedInRequestedRange)
        {
            return 0;
        }

        int score = 55;
        string roomText = $"{room.CardName} {room.RoomType} {room.Description}".ToLower();

        if (budgetLimit > 0)
        {
            if (room.PricePerNight <= budgetLimit)
            {
                score += 22;
                decimal ratio = room.PricePerNight / budgetLimit;
                if (ratio > 0.75m && ratio <= 1m)
                {
                    score += 6;
                }
            }
            else
            {
                decimal overRatio = (room.PricePerNight - budgetLimit) / budgetLimit;
                score -= Math.Min(25, (int)Math.Round(overRatio * 40));
            }
        }

        if (purposeTerms.Count > 0 && ContainsAny(roomText, purposeTerms))
        {
            score += 14;
        }

        if (guestTerms.Count > 0 && ContainsAny(roomText, guestTerms))
        {
            score += 10;
        }

        if (promptTokens.Count > 0)
        {
            int promptHits = promptTokens.Count(token => roomText.Contains(token));
            score += Math.Min(18, promptHits * 4);
        }

        if (preferenceTokens.Count > 0)
        {
            int preferenceHits = preferenceTokens.Count(token => roomText.Contains(token));
            score += Math.Min(16, preferenceHits * 4);
        }

        string roomStatus = (room.Status ?? string.Empty).ToLower();
        if (roomStatus == "trống" || roomStatus == "available" || roomStatus == "hoạt động" || roomStatus == string.Empty)
        {
            score += 6;
        }
        else
        {
            score -= 30;
        }

        if (stayNights >= 5 && ContainsAny(roomText, new[] { "suite", "view", "balcony", "spacious" }))
        {
            score += 6;
        }

        score += (StableHash(room.CardName + seed) % 5) - 2;
        return Math.Clamp(score, 20, 99);
    }

    private static string BuildRecommendationReason(
        Room room,
        decimal budgetLimit,
        string? roomPurpose,
        bool hasPrompt,
        bool hasPreference,
        int score)
    {
        var reasonParts = new List<string>();

        if (budgetLimit > 0)
        {
            if (room.PricePerNight <= budgetLimit)
            {
                reasonParts.Add("Phong nam trong ngan sach yeu cau");
            }
            else
            {
                reasonParts.Add("Phong vuot ngan sach nhung van phu hop theo tien ich va muc dich");
            }
        }

        string purposeLabel = (roomPurpose ?? string.Empty).Trim().ToLower() switch
        {
            "business" => "cong tac",
            "honeymoon" => "nghi duong/trang mat",
            "family" => "gia dinh",
            _ => string.Empty
        };

        if (!string.IsNullOrWhiteSpace(purposeLabel))
        {
            reasonParts.Add($"Khop nhu cau chuyen di: {purposeLabel}");
        }

        if (hasPrompt)
        {
            reasonParts.Add("Da xet yeu cau dac biet trong prompt cua le tan");
        }

        if (hasPreference)
        {
            reasonParts.Add("Da tan dung so thich khach hang tu lich su luu tru");
        }

        if (string.Equals((roomPurpose ?? string.Empty).Trim(), "family", StringComparison.OrdinalIgnoreCase))
        {
            reasonParts.Add("Uu tien bo cuc phu hop nhom khach gia dinh");
        }

        if (string.Equals((roomPurpose ?? string.Empty).Trim(), "business", StringComparison.OrdinalIgnoreCase))
        {
            reasonParts.Add("Uu tien khong gian thuan tien cho lam viec va nghi ngoi");
        }

        string summary = reasonParts.Count > 0
            ? string.Join(", ", reasonParts)
            : "Phong co diem can bang tot giua gia, loai phong va do san sang";

        return summary + ". Muc do phu hop tong hop: " + score + "%.";
    }

    private static string BuildLlmPrompt(
        BookingAiRecommendRequestDto request,
        Customer? customer,
        Room room,
        int score,
        string baseReason)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Du lieu goi y phong:");
        sb.AppendLine("- Khach: " + (customer?.FullName ?? request.CustomerQuery));
        sb.AppendLine("- Ngan sach: " + (request.BudgetLimit?.ToString() ?? "Khong gioi han"));
        sb.AppendLine("- Muc dich: " + (request.RoomPurpose ?? "Khong xac dinh"));
        sb.AppendLine("- So khach: " + (request.GuestCount?.ToString() ?? "Khong ro"));
        sb.AppendLine("- Ngay nhan/tra: " + (request.CheckInDate?.ToString("yyyy-MM-dd") ?? "--") + " -> " + (request.CheckOutDate?.ToString("yyyy-MM-dd") ?? "--"));
        sb.AppendLine("- Prompt bo sung: " + (request.AiPrompt ?? "Khong co"));
        sb.AppendLine("- Phong de xuat: " + room.CardName + " / " + room.RoomType);
        sb.AppendLine("- Gia phong: " + room.PricePerNight);
        sb.AppendLine("- Diem match: " + score + "%");
        sb.AppendLine("- Ly do rule-based: " + baseReason);
        sb.AppendLine("Hay viet lai ly do de xuat ngan gon, than thien, toi da 2 cau, bang tieng Viet.");
        return sb.ToString();
    }

    private static int CountNights(DateTime? checkInDate, DateTime? checkOutDate)
    {
        if (!checkInDate.HasValue || !checkOutDate.HasValue)
        {
            return 0;
        }

        return Math.Max(0, (checkOutDate.Value.Date - checkInDate.Value.Date).Days);
    }

    private static bool IsActiveBookingStatus(string? status)
    {
        string normalized = (status ?? string.Empty).Trim().ToLower();
        return normalized != "đã hủy" && normalized != "da huy" && normalized != "cancelled" && normalized != "hủy";
    }
}
