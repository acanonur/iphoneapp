/**
 * The two pages this server shows to a browser. They exist for one moment:
 * the phone's camera has read the QR code from the terminal, Safari opens,
 * and one tap hands the server's address (and its access key) to the app.
 *
 * The key travels in the part of the address after "#", which a browser never
 * sends to a server, so it does not end up in any log.
 */

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #f3f2f2; color: #201e1d;
    font: 400 17px/1.45 -apple-system, "Helvetica Neue", Arial, sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 440px; margin: 0 auto; padding: 28px 20px 40px; }
  .mark { display: flex; align-items: flex-end; gap: 5px; font-weight: 800; font-size: 30px; line-height: 1; letter-spacing: -0.02em; }
  .mark i { display: block; width: 8px; height: 8px; background: #ec3013; margin-bottom: 3px; }
  hr { border: 0; border-top: 2px solid #201e1d; margin: 18px 0 22px; }
  h1 { font-size: 34px; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 14px; font-weight: 800; }
  p { margin: 0 0 14px; }
  .muted { color: rgba(32, 30, 29, 0.7); font-size: 15px; }
  a.button {
    display: block; margin: 22px 0 18px; padding: 18px 20px; background: #ec3013; color: #f3f2f2;
    font-weight: 800; font-size: 18px; text-decoration: none;
  }
  code { font: 14px/1.4 ui-monospace, Menlo, monospace; word-break: break-all; }
  .box { border: 1px solid rgba(32, 30, 29, 0.4); background: #eae9e9; padding: 12px 14px; margin: 0 0 14px; }
  .ok { display: inline-block; width: 10px; height: 10px; background: #ec3013; margin-right: 8px; }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="mark">Yaver<i></i></div>
<hr>
${body}
</main>
</body>
</html>`;
}

/** `/` — proof, in a browser, that the phone can reach this computer. */
export function landingPage(): string {
  return page(
    'Yaver server',
    `<h1>The server is running.</h1>
<p><span class="ok"></span>If you can read this on your iPhone, the phone can reach this computer.</p>
<p class="muted">Der Server läuft. Wenn Sie diese Seite auf dem iPhone sehen, erreicht das Telefon diesen Computer.</p>
<p class="muted">Sunucu çalışıyor. Bu sayfayı iPhone’unuzda görüyorsanız telefon bu bilgisayara ulaşabiliyor.</p>
<a class="button" href="/pair">Connect the app →</a>`,
  );
}

/** `/pair` — one button that opens the app with this server's address. */
export function pairPage(): string {
  return page(
    'Connect Yaver',
    `<h1>Connect your iPhone.</h1>
<p>Tap the button. The Yaver app opens and saves this server’s address.</p>
<p class="muted">Tippen Sie auf die Schaltfläche. Die Yaver-App öffnet sich und speichert die Adresse dieses Servers.</p>
<p class="muted">Düğmeye dokunun. Yaver uygulaması açılır ve bu sunucunun adresini kaydeder.</p>
<a class="button" id="open" href="#">Open Yaver →</a>
<p class="muted">The first time, the iPhone asks whether Yaver may find devices on your local network. Say yes — without it the app cannot reach this server, even though this page can.</p>
<p class="muted">Nothing happens? Open the app, go to Settings → Server, and enter:</p>
<div class="box"><code id="address"></code></div>
<div class="box" id="keybox" hidden><span class="muted">Access key</span><br><code id="key"></code></div>
<script>
  (function () {
    var origin = location.origin;
    var key = new URLSearchParams(location.hash.slice(1)).get('k') || '';
    var link = 'yaver://pair?url=' + encodeURIComponent(origin) + (key ? '&key=' + encodeURIComponent(key) : '');
    document.getElementById('open').setAttribute('href', link);
    document.getElementById('address').textContent = origin;
    if (key) {
      document.getElementById('key').textContent = key;
      document.getElementById('keybox').hidden = false;
    }
  })();
</script>`,
  );
}

/** The address the QR code carries: the pairing page, with the key after "#". */
export function pairingLink(baseUrl: string, key: string | null): string {
  return key ? `${baseUrl}/pair#k=${encodeURIComponent(key)}` : `${baseUrl}/pair`;
}
