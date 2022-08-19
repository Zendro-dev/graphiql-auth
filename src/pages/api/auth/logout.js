
import { BASEPATH } from '@/config/globals';

const OAUTH2_ISSUER = String(process.env.OAUTH2_ISSUER ?? '');
const NEXTAUTH_URL = String(process.env.NEXTAUTH_URL ?? '');
const LOGOUT_URL = String(process.env.OAUTH2_LOGOUT_URL ?? '');
const OAUTH2_CLIENT_ID = String(process.env.OAUTH2_CLIENT_ID ?? '');

const ORIGIN = `${new URL(NEXTAUTH_URL).origin}${BASEPATH}/`;

const LOGOUT =
  LOGOUT_URL !== ''
    ? LOGOUT_URL
    : `${OAUTH2_ISSUER}/protocol/openid-connect/logout`;

export default (req, res) => {
  res.redirect(
    `${LOGOUT}?client_id=${OAUTH2_CLIENT_ID}&post_logout_redirect_uri=${encodeURIComponent(
      ORIGIN
    )}`
  );
};