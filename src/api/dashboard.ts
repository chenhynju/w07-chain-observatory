export const dashboard = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>W07 Chain Observatory</title>
<style>
body { font: 1rem system-ui; max-width: 52rem; margin: 3rem auto; padding: 0 1rem; color: #15243b; }
section { background: #eff4fa; padding: 1rem; margin: 1rem 0; border-radius: .5rem; }
pre { overflow: auto; } input { max-width: 100%; } button { margin-left: .5rem; }
</style>
<h1>W07 Chain Observatory</h1>
<p>Pair analytics in raw token units. Live observations can change during a chain reorganization.</p>
<section><h2>Block snapshot</h2><form data-path="/snapshot/">
<label>Sync block <input name="value" required pattern="[0-9]{1,16}"></label><button>Load</button>
</form><pre aria-live="polite"></pre></section>
<section><h2>LP wallet history</h2><form data-path="/wallet/">
<label>Wallet <input name="value" required pattern="0x[0-9a-fA-F]{40}" size="44"></label><button>Load</button>
</form><pre aria-live="polite"></pre></section>
<section><h2>Large token0 inputs</h2><form data-path="/alerts?minToken0=">
<label>End block <input name="height" required pattern="[0-9]{1,16}"></label>
<label>Minimum raw input <input name="value" required pattern="[0-9]{1,78}"></label><button>Load</button>
</form><pre aria-live="polite"></pre></section>
<script>
for (const form of document.querySelectorAll("form")) {
  let request;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    request?.abort();
    request = new AbortController();
    const signal = request.signal;
    const output = form.nextElementSibling;
    output.textContent = "Loading…";
    try {
      const value = new FormData(form).get("value");
      const height = new FormData(form).get("height");
      const path = form.dataset.path + encodeURIComponent(value);
      const response = await fetch(height ? path + "&height=" + encodeURIComponent(height) : path, { signal });
      const data = await response.json();
      if (!signal.aborted) output.textContent = JSON.stringify(data, null, 2);
    } catch {
      if (!signal.aborted) output.textContent = "Could not load indexer data.";
    }
  });
}
</script>
</html>`;
