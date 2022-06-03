
const OAUTH2_ISSUER = String(process.env.OAUTH2_ISSUER ?? '');
const NEXTAUTH_URL = String(process.env.NEXTAUTH_URL ?? '');
const BASE_URL = NEXTAUTH_URL.replace('/api/auth','');

export default (req, res) => {
  res.redirect(
    `${OAUTH2_ISSUER}/protocol/openid-connect/logout?redirect_uri=${encodeURIComponent(
      BASE_URL
    )}`
  );
};