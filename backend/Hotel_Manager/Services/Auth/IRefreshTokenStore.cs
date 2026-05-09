namespace Hotel_Manager.Services.Auth
{
    public interface IRefreshTokenStore
    {
        string IssueToken(int accountId, TimeSpan lifetime);
        bool TryGetAccountId(string refreshToken, out int accountId);
        void Revoke(string refreshToken);
        void RevokeAllForAccount(int accountId);
    }
}
