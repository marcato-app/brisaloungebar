// GitHub OAuth relay for the Decap CMS admin panel (/admin).
//
// Static hosts (Cloudflare Pages included) can't hold a GitHub OAuth
// "client secret" safely, so Decap CMS needs a tiny server-side helper to
// complete the login handshake. This Worker is that helper — it never
// stores or sees menu content, it only exchanges a GitHub login code for
// an access token that the browser then uses to commit changes.
//
// Setup: see ../oauth-worker/README.md
// (redeploy trigger: force a fresh build to pick up dashboard secrets)

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      const redirectUri = `${url.origin}/callback`;
      const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
      authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      authorizeUrl.searchParams.set("scope", "repo,user");
      authorizeUrl.searchParams.set("state", crypto.randomUUID());
      return Response.redirect(authorizeUrl.toString(), 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Código de autorização ausente.", { status: 400 });
      }

      const tokenRes = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
        return renderMessagePage(
          "error",
          tokenData.error_description || "Falha ao autenticar com o GitHub."
        );
      }

      return renderMessagePage(
        "success",
        JSON.stringify({ token: tokenData.access_token, provider: "github" })
      );
    }

    return new Response("Not found", { status: 404 });
  },
};

// Implements the handshake Decap CMS's popup window expects: it first
// echoes "authorizing:github" to the opener so it learns the popup's
// origin, then sends the real result on that origin.
function renderMessagePage(status, payload) {
  const message = `authorization:github:${status}:${payload}`;
  const html = `<!DOCTYPE html>
<html><body>
<script>
(function () {
  function receiveMessage(e) {
    window.opener.postMessage(${JSON.stringify(message)}, e.origin);
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
