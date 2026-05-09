using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Hotel_Manager.Services.BookingAi;

public interface IGoogleGeminiReasoningClient
{
    Task<string?> GenerateReasonAsync(string prompt, CancellationToken cancellationToken = default);
}

public class GoogleGeminiReasoningClient : IGoogleGeminiReasoningClient
{
    private readonly HttpClient _httpClient;
    private readonly BookingAiOptions _options;
    private readonly ILogger<GoogleGeminiReasoningClient> _logger;

    public GoogleGeminiReasoningClient(HttpClient httpClient, IOptions<BookingAiOptions> options, ILogger<GoogleGeminiReasoningClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string?> GenerateReasonAsync(string prompt, CancellationToken cancellationToken = default)
    {
        if (!_options.EnableLlmReasoning)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(_options.GoogleGeminiApiKey))
        {
            _logger.LogWarning("GoogleGeminiApiKey is not configured");
            return null;
        }

        try
        {
            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                systemInstruction = new
                {
                    parts = new[]
                    {
                        new { text = "Bạn là trợ lý gợi ý phòng cho khách sạn. Trả lời ngắn gọn bằng tiếng Việt, tối đa 2 câu. Không cần giải thích thêm." }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.2,
                    maxOutputTokens = 200
                }
            };

            string url = $"https://generativelanguage.googleapis.com/v1beta/models/{_options.GoogleGeminiModel}:generateContent?key={_options.GoogleGeminiApiKey}";

            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(5, _options.LlmTimeoutSeconds)));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

            using var response = await _httpClient.PostAsJsonAsync(url, requestBody, linkedCts.Token);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(linkedCts.Token);
                _logger.LogWarning($"Google Gemini API error: {response.StatusCode} - {errorContent}");
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(linkedCts.Token);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: linkedCts.Token);

            
            if (document.RootElement.TryGetProperty("candidates", out var candidatesElement)
                && candidatesElement.ValueKind == JsonValueKind.Array
                && candidatesElement.GetArrayLength() > 0)
            {
                var firstCandidate = candidatesElement[0];
                if (firstCandidate.TryGetProperty("content", out var contentElement)
                    && contentElement.TryGetProperty("parts", out var partsElement)
                    && partsElement.ValueKind == JsonValueKind.Array
                    && partsElement.GetArrayLength() > 0)
                {
                    var firstPart = partsElement[0];
                    if (firstPart.TryGetProperty("text", out var textElement)
                        && textElement.ValueKind == JsonValueKind.String)
                    {
                        string result = textElement.GetString()?.Trim() ?? string.Empty;
                        if (!string.IsNullOrWhiteSpace(result))
                        {
                            return result;
                        }
                    }
                }
            }

            _logger.LogWarning("Unexpected response structure from Google Gemini API");
            return null;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "HTTP error calling Google Gemini API");
            return null;
        }
        catch (OperationCanceledException ex)
        {
            _logger.LogWarning(ex, "Google Gemini API request timeout");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error calling Google Gemini API");
            return null;
        }
    }
}
