export function renderConsolePage(gatewayPort: number): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>portkey</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #16181d;
    --muted: #5b6270;
    --border: #d8dbe2;
    --accent: #2f6fed;
    --card-bg: #f6f7f9;
    --mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161a;
      --fg: #e7e9ee;
      --muted: #9aa1ad;
      --border: #2c2f36;
      --card-bg: #1c1f25;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--sans);
  }
  .wrap { max-width: 640px; margin: 0 auto; padding: 64px 24px 120px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .lede { color: var(--muted); margin: 0 0 32px; font-size: 14px; }
  .combo {
    display: flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--card-bg);
  }
  .combo input {
    border: none;
    background: transparent;
    padding: 14px 12px;
    outline: none;
    color: var(--fg);
    font: inherit;
  }
  .combo .host { flex: 1; min-width: 0; }
  .combo .sep { color: var(--muted); padding: 0 2px; }
  .combo .port { width: 90px; }
  .hint { margin-top: 6px; font-size: 12px; color: var(--muted); min-height: 16px; }
  .hint.error { color: #d5495a; }
  .result {
    margin-top: 28px;
    padding: 16px;
    border: 1px dashed var(--border);
    border-radius: 10px;
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .result.visible { display: flex; }
  .result a {
    font-family: var(--mono);
    font-size: 14px;
    color: var(--accent);
    text-decoration: none;
    word-break: break-all;
  }
  .result a:hover { text-decoration: underline; }
  .copybtn {
    flex: none;
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    color: var(--fg);
    font: inherit;
  }
  .copybtn.copied { border-color: var(--accent); color: var(--accent); }
  details {
    margin-top: 40px;
    border-top: 1px solid var(--border);
    padding-top: 16px;
  }
  summary { cursor: pointer; color: var(--muted); font-size: 13px; }
  .help-body { margin-top: 12px; font-size: 13px; color: var(--muted); line-height: 1.7; }
  .help-body dt { color: var(--fg); font-family: var(--mono); margin-top: 8px; }
  code { font-family: var(--mono); }
</style>
</head>
<body>
<div class="wrap">
  <h1>portkey</h1>
  <p class="lede">サンドボックス内のサーバーに、ホスト名とポートを指定するだけでアクセスできるURLを作ります。</p>

  <div class="combo">
    <input class="host" id="host" placeholder="ホスト名 (例: localhost)" autocomplete="off">
    <span class="sep">~</span>
    <input class="port" id="port" placeholder="ポート" inputmode="numeric" autocomplete="off">
  </div>
  <div class="hint" id="hint"></div>

  <div class="result" id="result">
    <a id="url" href="#" target="_blank" rel="noopener"></a>
    <button class="copybtn" id="copy" type="button">コピー</button>
  </div>

  <details>
    <summary>使い方・用語について</summary>
    <div class="help-body">
      <p>portkeyはサンドボックスコンテナ内で複数起動しているHTTPサーバー(アップストリーム)に、単一のゲートウェイポート(このコンソールでは ${gatewayPort})越しにアクセスするためのリバースプロキシです。上のフォームで生成したURLにアクセスすると、指定したホスト名・ポートで動くサーバーに転送されます。</p>
      <dl>
        <dt>アップストリーム</dt>
        <dd>portkeyがリクエストを転送する先のHTTPサーバー。ホスト名とポートの組で識別します。</dd>
        <dt>&lt;ホスト名&gt;~&lt;ポート&gt;</dt>
        <dd>アップストリームを一意に指す識別子の書式。例: <code>myapp~3000</code></dd>
        <dt>ゲートウェイポート</dt>
        <dd>portkey自身が待ち受けるポート(既定 1541)。アップストリーム側のポートとは別物です。</dd>
      </dl>
    </div>
  </details>
</div>

<script>
(function () {
  "use strict";

  var GATEWAY_PORT = ${gatewayPort};
  var HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  function validateHost(host) {
    if (!host) return "ホスト名を入力してください";
    if (!HOST_RE.test(host)) return "ホスト名の形式が不正です(英数字・ハイフン・ドット区切りのみ)";
    return null;
  }

  function validatePort(portStr) {
    if (!portStr) return "ポートを入力してください";
    if (!/^[0-9]+$/.test(portStr)) return "ポートは数字のみです";
    if (portStr.length > 1 && portStr[0] === "0") return "先頭に0は付けられません";
    var n = parseInt(portStr, 10);
    if (n < 1 || n > 65535) return "ポートは1〜65535の範囲で指定してください";
    return null;
  }

  function buildUrl(host, port) {
    return "http://" + host.toLowerCase() + "~" + port + ".localhost:" + GATEWAY_PORT + "/";
  }

  var hostEl = document.getElementById("host");
  var portEl = document.getElementById("port");
  var hintEl = document.getElementById("hint");
  var resultEl = document.getElementById("result");
  var urlEl = document.getElementById("url");
  var copyBtn = document.getElementById("copy");

  function update() {
    var host = hostEl.value.trim();
    var port = portEl.value.trim();
    hintEl.textContent = "";
    hintEl.classList.remove("error");

    if (!host && !port) {
      resultEl.classList.remove("visible");
      return;
    }
    var hErr = validateHost(host);
    var pErr = validatePort(port);
    if (hErr || pErr) {
      hintEl.textContent = hErr || pErr;
      hintEl.classList.add("error");
      resultEl.classList.remove("visible");
      return;
    }
    var url = buildUrl(host, port);
    urlEl.textContent = url;
    urlEl.href = url;
    resultEl.classList.add("visible");
    copyBtn.textContent = "コピー";
    copyBtn.classList.remove("copied");
  }

  hostEl.addEventListener("input", update);
  portEl.addEventListener("input", update);
  copyBtn.addEventListener("click", function () {
    var text = urlEl.textContent;
    var done = function () {
      copyBtn.textContent = "コピーしました";
      copyBtn.classList.add("copied");
      setTimeout(function () {
        copyBtn.textContent = "コピー";
        copyBtn.classList.remove("copied");
      }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      done();
    }
  });
})();
</script>
</body>
</html>
`;
}
