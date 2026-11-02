/**
 * The figure preview that MCP App hosts (claude.ai) show under a draw_figure
 * or render_doc call: the figure on white paper, with buttons to copy the SVG
 * or TikZ, download PNG or SVG, and open it in the editor.
 *
 * It is one self-contained page with no network access, as the default
 * content policy of MCP Apps requires. It talks to the host over postMessage
 * (JSON-RPC, spec 2026-01-26) and reads the figure from the tool result's
 * `_meta`, so the buttons work whatever outputs the agent asked for.
 */

export const VIEW_URI = "ui://geosimples/figure.html";
export const VIEW_MIME = "text/html;profile=mcp-app";
/** Where the view finds the figure in a tool result's `_meta`. */
export const FIGURE_META = "geosimples/figure";

/** What the view needs from a drawn figure. */
export interface ViewFigure {
  name: string;
  svg: string;
  tikz: string;
  link: string;
}

const STYLE = `
:root {
  color-scheme: light dark;
  --fg: var(--color-text-primary, #1a1a1a);
  --muted: var(--color-text-secondary, #6b6b6b);
  --line: var(--color-border-primary, rgba(127, 127, 127, 0.35));
  --button: var(--color-background-primary, transparent);
  --accent: #059669;
  font-family: var(--font-sans, system-ui, -apple-system, "Segoe UI", sans-serif);
}
* { box-sizing: border-box; }
body { margin: 0; padding: 4px; background: transparent; color: var(--fg); }
.paper { background: #fff; border-radius: 10px; border: 1px solid var(--line); padding: 16px; display: flex; justify-content: center; }
.paper svg { display: block; width: 100%; max-width: 560px; height: auto; max-height: 520px; }
.bar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
button {
  font: inherit; font-size: 13px; line-height: 1; padding: 8px 11px; border-radius: 7px;
  border: 1px solid var(--line); background: var(--button); color: var(--fg); cursor: pointer;
}
button:hover { border-color: var(--accent); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.status { font-size: 12px; color: var(--muted); min-height: 16px; margin: 8px 2px 0; }
.message { font-size: 13px; white-space: pre-wrap; color: var(--muted); margin: 8px 2px; }
`;

const SCRIPT = `
(function () {
  var FIGURE_META = ${JSON.stringify(FIGURE_META)};
  var app = document.getElementById("app");
  var nextId = 1;
  var pending = {};
  var figure = null;

  function send(message) { window.parent.postMessage(message, "*"); }
  function notify(method, params) { send({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      send({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    });
  }

  window.addEventListener("message", function (event) {
    var m = event.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id !== undefined && pending[m.id] && (m.result !== undefined || m.error !== undefined)) {
      var p = pending[m.id];
      delete pending[m.id];
      if (m.error) p.reject(m.error); else p.resolve(m.result);
      return;
    }
    if (m.method === "ui/notifications/tool-result") show(m.params || {});
    else if (m.method === "ui/notifications/host-context-changed") applyContext(m.params);
    else if (m.method === "ui/notifications/tool-cancelled") message("O desenho foi cancelado.");
    else if (m.id !== undefined && (m.method === "ui/resource-teardown" || m.method === "ping")) send({ jsonrpc: "2.0", id: m.id, result: {} });
  });

  function applyContext(context) {
    var vars = context && context.styles && context.styles.variables;
    if (!vars) return;
    for (var key in vars) if (vars[key]) document.documentElement.style.setProperty(key, vars[key]);
  }

  function element(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function message(text) {
    app.replaceChildren(element("p", "message", text));
    resize();
  }

  function textOf(result) {
    return (result.content || []).filter(function (c) { return c.type === "text"; }).map(function (c) { return c.text; }).join("\\n");
  }

  var status;
  function say(text) {
    status.textContent = text;
    clearTimeout(say.timer);
    say.timer = setTimeout(function () { status.textContent = ""; }, 4000);
  }

  function fileName(ext) {
    var base = (figure.name || "figura").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return (base || "figura") + "." + ext;
  }

  function copy(text, what) {
    function fallback() {
      var area = element("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      area.remove();
      say(ok ? what + " copiado." : "Não deu para copiar aqui. Use Abrir no GeoSimples.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { say(what + " copiado."); }, fallback);
    } else fallback();
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = element("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    say("Baixando " + name + ". Se não começar, use Abrir no GeoSimples e exporte por lá.");
  }

  function downloadPng() {
    var image = new Image();
    image.onload = function () {
      var scale = 4;
      var canvas = element("canvas");
      canvas.width = Math.ceil(image.width * scale);
      canvas.height = Math.ceil(image.height * scale);
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        if (blob) download(blob, fileName("png"));
        else say("Não deu para gerar o PNG aqui. Use Abrir no GeoSimples.");
      }, "image/png");
    };
    image.onerror = function () { say("Não deu para gerar o PNG aqui. Use Abrir no GeoSimples."); };
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(figure.svg);
  }

  function open() {
    request("ui/open-link", { url: figure.link }).catch(function () { window.open(figure.link, "_blank", "noopener"); });
  }

  function button(label, onClick, primary) {
    var b = element("button", primary ? "primary" : "", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function show(result) {
    var data = result._meta && result._meta[FIGURE_META];
    if (result.isError || !data || !data.svg) {
      message(textOf(result) || "Não há figura para mostrar.");
      return;
    }
    figure = data;
    var paper = element("div", "paper");
    paper.innerHTML = figure.svg;
    paper.setAttribute("role", "img");
    paper.setAttribute("aria-label", figure.name || "Figura");
    var bar = element("div", "bar");
    bar.append(
      button("Copiar SVG", function () { copy(figure.svg, "SVG"); }),
      button("Copiar TikZ", function () { copy(figure.tikz, "TikZ"); }),
      button("Baixar PNG", downloadPng),
      button("Baixar SVG", function () { download(new Blob([figure.svg], { type: "image/svg+xml" }), fileName("svg")); }),
      button("Abrir no GeoSimples", open, true)
    );
    status = element("p", "status");
    status.setAttribute("aria-live", "polite");
    app.replaceChildren(paper, bar, status);
    resize();
  }

  var lastHeight = 0;
  function resize() {
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    notify("ui/notifications/size-changed", { width: Math.ceil(document.documentElement.scrollWidth), height: height });
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body);

  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    clientInfo: { name: "geosimples-figure", version: "1.0.0" },
    appCapabilities: { availableDisplayModes: ["inline"] }
  }).then(function (result) {
    applyContext(result && result.hostContext);
    notify("ui/notifications/initialized");
  }, function () { notify("ui/notifications/initialized"); });
  resize();
})();
`;

export const VIEW_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GeoSimples</title>
<style>${STYLE}</style>
</head>
<body>
<main id="app"><p class="message">Desenhando a figura…</p></main>
<script>${SCRIPT}</script>
</body>
</html>
`;
