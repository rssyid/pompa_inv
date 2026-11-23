import http from "node:http";
import readline from "node:readline";
import { google } from "googleapis";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

async function main() {
  console.log("=== Generator Google Drive OAuth2 Refresh Token ===");
  console.log("Pastikan Anda telah membuat OAuth 2.0 Client ID (Desktop App atau Web App dengan redirect http://localhost:3333/oauth2callback) di Google Cloud Console.\n");

  const clientId = await ask("Masukkan GOOGLE_CLIENT_ID: ");
  const clientSecret = await ask("Masukkan GOOGLE_CLIENT_SECRET: ");
  const redirectUri = "http://localhost:3333/oauth2callback";

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });

  console.log("\nBuka URL berikut di browser Anda lalu login dengan akun Google Drive tujuan:\n");
  console.log(authUrl);
  console.log("\nMenunggu callback di http://localhost:3333/oauth2callback ...");

  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.url.startsWith("/oauth2callback")) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const url = new URL(req.url, "http://localhost:3333");
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Authorization code tidak ditemukan.");
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h2>Berhasil!</h2><p>Refresh token sudah tampil di terminal. Silakan tutup tab ini.</p>");
      console.log("\n=== BERHASIL ===");
      console.log("GOOGLE_REFRESH_TOKEN=" + (tokens.refresh_token ?? "(tidak muncul, pastikan pakai prompt=consent)"));
    } catch (err) {
      res.writeHead(500);
      res.end("Gagal menukar authorization code.");
      console.error("Gagal menukar token:", err);
    } finally {
      rl.close();
      server.close();
    }
  });

  server.listen(3333);
}

main();
