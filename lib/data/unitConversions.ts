export const unitConversionsData = {
  volume: {
    ml: 1,
    l: 1000,
    cup: 240,
    tbsp: 15,
    tsp: 5,
    'fl-oz': 30,
    pint: 473,
    quart: 946,
    gallon: 3785,
  },
  weight: {
    g: 1,
    kg: 1000,
    oz: 28.35,
    lb: 453.59,
  },
  temperature: {
    celsiusToFahrenheit: (c: number) => (c * 9) / 5 + 32,
    fahrenheitToCelsius: (f: number) => ((f - 32) * 5) / 9,
  },
};
