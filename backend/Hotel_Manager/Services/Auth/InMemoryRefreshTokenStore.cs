using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Hotel_Manager.Services.Auth
{
    public class InMemoryRefreshTokenStore : IRefreshTokenStore
    {
        private readonly ConcurrentDictionary<string, RefreshTokenRecord> _tokens = new();

        public string IssueToken(int accountId, TimeSpan lifetime)
        {
            CleanupExpiredTokens();

            var token = GenerateToken();
            _tokens[token] = new RefreshTokenRecord
            {
                AccountId = accountId,
                ExpiresAt = DateTime.UtcNow.Add(lifetime)
            };

            return token;
        }

        public bool TryGetAccountId(string refreshToken, out int accountId)
        {
            accountId = 0;
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return false;
            }

            if (!_tokens.TryGetValue(refreshToken, out var record))
            {
                return false;
            }

            if (record.ExpiresAt <= DateTime.UtcNow)
            {
                _tokens.TryRemove(refreshToken, out _);
                return false;
            }

            accountId = record.AccountId;
            return true;
        }

        public void Revoke(string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return;
            }

            _tokens.TryRemove(refreshToken, out _);
        }

        public void RevokeAllForAccount(int accountId)
        {
            var matchedTokens = _tokens
                .Where(pair => pair.Value.AccountId == accountId)
                .Select(pair => pair.Key)
                .ToList();

            foreach (var token in matchedTokens)
            {
                _tokens.TryRemove(token, out _);
            }
        }

        private void CleanupExpiredTokens()
        {
            var expiredTokens = _tokens
                .Where(pair => pair.Value.ExpiresAt <= DateTime.UtcNow)
                .Select(pair => pair.Key)
                .ToList();

            foreach (var token in expiredTokens)
            {
                _tokens.TryRemove(token, out _);
            }
        }

        private static string GenerateToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(64);
            return Convert.ToBase64String(bytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");
        }

        private class RefreshTokenRecord
        {
            public int AccountId { get; set; }
            public DateTime ExpiresAt { get; set; }
        }
    }
}
