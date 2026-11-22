declare const math: {
  createUnit: (name: string, definition: object, options?: object) => void;
  unit: (value: number, unit: string) => unknown;
};

interface CurrencyData {
  base: string;
  base_code: string;
  rates: Record<string, number>;
}

const kRefreshIntervalMs = 1000 * 3600 * 4;

let currencyData: CurrencyData | undefined;
let currencyDataFetchedAt = 0;

// returns cached data if fresh, otherwise re-fetches.
// on fetch failure returns stale data (if any)
async function getCurrencyData() {
  if (currencyData !== undefined && Date.now() - currencyDataFetchedAt < kRefreshIntervalMs) {
    return currencyData;
  }
  try {
    const response = await fetch("/api/currency_rates.json", {
      cache: "no-cache",
    });
    if (!response.ok) return currencyData;
    currencyData = JSON.parse(await response.text());
    currencyDataFetchedAt = Date.now();
  } catch (e) {
    console.log("getCurrencyData: error:", e);
  }
  return currencyData;
}

let refreshTimer: ReturnType<typeof setInterval> | undefined;

// loads currencies and refreshes them periodically. Safe to call multiple times
export function startCurrencyRefresh() {
  if (refreshTimer !== undefined) {
    return;
  }
  loadCurrenciesWithRetry();
  refreshTimer = setInterval(loadCurrencies, kRefreshIntervalMs);
}

// returns true if currency units were (re)created
export async function loadCurrencies(): Promise<boolean> {
  const data = await getCurrencyData();
  if (!data) return false;
  data.base = data.base_code; // our api returns base_code, the code expects base
  try {
    // override: units might exist from a previous (possibly partial) load
    math.createUnit(data.base, { aliases: [data.base.toLowerCase()] }, { override: true });
    for (let currency of Object.keys(data.rates)) {
      if (currency === data.base) {
        continue;
      }
      math.createUnit(
        currency,
        {
          definition: math.unit(1 / data.rates[currency]!, data.base),
          aliases: currency === "CUP" ? [] : [currency.toLowerCase()], // Lowercase CUP clashes with the measurement unit cup
        },
        { override: true },
      );
    }
  } catch (e) {
    console.error("loadCurrencies: failed to create currency units:", e);
    return false;
  }
  window.document.dispatchEvent(new Event("currenciesLoaded"));
  return true;
}

const kRetryDelayMs = 60 * 1000;

// loads currencies; on failure (e.g. offline) retries with increasing delay
async function loadCurrenciesWithRetry(delayMs = kRetryDelayMs) {
  let ok = false;
  try {
    ok = await loadCurrencies();
  } catch (e) {
    console.error("loadCurrencies failed:", e);
  }
  if (!ok) {
    setTimeout(() => loadCurrenciesWithRetry(Math.min(delayMs * 2, kRefreshIntervalMs)), delayMs);
  }
}
