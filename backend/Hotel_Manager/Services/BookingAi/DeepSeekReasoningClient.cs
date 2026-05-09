using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Hotel_Manager.Services.BookingAi;

public interface IDeepSeekReasoningClient
{
    Task<string?> GenerateReasonAsync(string prompt, CancellationToken cancellationToken = default);
}

public class DeepSeekReasoningClient : IDeepSeekReasoningClient
{
    private readonly HttpClient _httpClient;
    private readonly BookingAiOptions _options;
    private readonly ILogger<DeepSeekReasoningClient> _logger;

    public DeepSeekReasoningClient(HttpClient httpClient, IOptions<BookingAiOptions> options, ILogger<DeepSeekReasoningClient> logger)
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

        if (string.IsNullOrWhiteSpace(_options.DeepSeekApiKey))
        {
            _logger.LogWarning("DeepSeekApiKey is not configured");
            return null;
        }

        var requestPayload = new
        {
            model = string.IsNullOrWhiteSpace(_options.DeepSeekModel) ? "deepseek-chat" : _options.DeepSeekModel,
            messages = new[]
            {
                new { role = "system", content = "Bạn là trợ lý gợi ý phòng cho khách sạn. Trả lời ngắn gọn bằng tiếng Việt, tối đa 2 câu. Không cần giải thích thêm." },
                new { role = "user", content = prompt }
            },
            temperature = 0.2,
            max_tokens = 200,
            stream = false
        };

        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(5, _options.LlmTimeoutSeconds)));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        using var request = new HttpRequestMessage(HttpMethod.Post, "/chat/completions")
        {
            Content = JsonContent.Create(requestPayload)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.DeepSeekApiKey);

        using var response = await _httpClient.SendAsync(request, linkedCts.Token);
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync(linkedCts.Token);
            _logger.LogWarning("DeepSeek API error: {StatusCode} - {Body}", response.StatusCode, errorContent);
            return null;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(linkedCts.Token);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: linkedCts.Token);

        if (document.RootElement.TryGetProperty("choices", out var choicesElement)
            && choicesElement.ValueKind == JsonValueKind.Array
            && choicesElement.GetArrayLength() > 0)
        {
            var firstChoice = choicesElement[0];
            if (firstChoice.TryGetProperty("message", out var messageElement)
                && messageElement.TryGetProperty("content", out var contentElement)
                && contentElement.ValueKind == JsonValueKind.String)
            {
                var text = contentElement.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    return text;
                }
            }
        }

        _logger.LogWarning("Unexpected response structure from DeepSeek API");
        return null;
    }
}
