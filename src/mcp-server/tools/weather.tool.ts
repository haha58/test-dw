type WeatherQueryArgs = {
  city: string;
};

type WeatherInfo = {
  temp: number;
  weather: string;
  humidity: number;
  wind: string;
};

export async function handleWeatherQuery(
  args: WeatherQueryArgs,
): Promise<string> {
  const { city } = args;

  const weatherData: Record<string, WeatherInfo> = {
    Beijing: { temp: 18, weather: "Sunny", humidity: 35, wind: "North wind 3" },
    Shanghai: {
      temp: 22,
      weather: "Cloudy",
      humidity: 68,
      wind: "Southeast wind 2",
    },
    Wuhan: { temp: 25, weather: "Light rain", humidity: 78, wind: "East wind 1" },
    Guangzhou: {
      temp: 28,
      weather: "Sunny",
      humidity: 72,
      wind: "South wind 2",
    },
    Shenzhen: {
      temp: 27,
      weather: "Cloudy",
      humidity: 75,
      wind: "Southeast wind 2",
    },
  };

  const data = weatherData[city];
  if (!data) {
    return `Weather query for ${city} is not supported. Supported cities: Beijing, Shanghai, Wuhan, Guangzhou, Shenzhen.`;
  }

  return `${city} weather: ${data.weather}, temperature ${data.temp} C, humidity ${data.humidity}%, ${data.wind}.`;
}
