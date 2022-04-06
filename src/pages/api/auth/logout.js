
const OAUTH2_ISSUER = String(process.env.OAUTH2_ISSUER ?? '');
const NEXTAUTH_URL = String(process.env.NEXTAUTH_URL ?? '');

export default (req, res) => {
  res.redirect(
    `${OAUTH2_ISSUER}/protocol/openid-connect/logout?redirect_uri=${encodeURIComponent(
      NEXTAUTH_URL
    )}`
  );
};