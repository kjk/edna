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
  loadCurrencies();
  refreshTimer = setInterval(loadCurrencies, kRefreshIntervalMs);
}

let currenciesLoaded = false;
export async function loadCurrencies() {
  const data = await getCurrencyData();
  if (!data) return;
  data.base = data.base_code; // our api returns base_code, the code expects base
  if (!currenciesLoaded) {
    math.createUnit(data.base, {
      override: currenciesLoaded,
      aliases: [data.base.toLowerCase()],
    });
  }

  Object.keys(data.rates)
    .filter(function (currency) {
      return currency !== data.base;
    })
    .forEach(function (currency) {
      math.createUnit(
        currency,
        {
          definition: math.unit(1 / data.rates[currency]!, data.base),
          aliases: currency === "CUP" ? [] : [currency.toLowerCase()], // Lowercase CUP clashes with the measurement unit cup
        },
        { override: currenciesLoaded },
      );
    });
  currenciesLoaded = true;
  window.document.dispatchEvent(new Event("currenciesLoaded"));
}
