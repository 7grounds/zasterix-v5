import "dotenv/config";

async function main() {
  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    console.error("Missing API_URL. Add it to your local .env (not committed).");
    process.exit(1);
  }

  console.log("API_URL:", apiUrl);

  const res = await fetch(apiUrl, { method: "GET" });
  console.log("HTTP status:", res.status, res.statusText);

  // Supabase project base URL returns 404 at "/"; that still proves the host is reachable.
  if ([200, 204, 301, 302, 401, 403, 404].includes(res.status)) {
    console.log("Reachable ✅");
    process.exit(0);
  }

  const text = await res.text();
  console.log("Response preview:", text.slice(0, 300));
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
