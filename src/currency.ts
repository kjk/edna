declare const math: {
  createUnit: (name: string, definition: object, options?: object) => void;
  unit: (value: number, unit: string) => unknown;
};

interface CurrencyData {
  base: string;
  base_code: string;
  rates: Record<string, number>;
}

let currencyData: CurrencyData | undefined;
async function getCurrencyData() {
  if (currencyData !== undefined) {
    return currencyData;
  }
  const response = await fetch("/api/currency_rates.json", {
    cache: "no-cache",
  });
  if (!response.ok) return;
  try {
    currencyData = JSON.parse(await response.text());
    return currencyData;
  } catch (e) {
    console.log("getCurrencyData: error:", e);
  }
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
