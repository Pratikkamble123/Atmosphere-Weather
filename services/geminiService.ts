
import { GoogleGenAI, Type } from "@google/genai";
import { WeatherData, AIInsights } from "../types";
import { LanguageCode, languages } from "../translations";

export const getAIInsights = async (weather: WeatherData, lang: LanguageCode): Promise<AIInsights> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = languages[lang].name;
  
  const prompt = `
    Based on this current weather for ${weather.city}:
    Temp: ${weather.temp}°C, Feels like: ${weather.feelsLike}°C
    Condition: ${weather.condition}
    Rain Chance: ${weather.rainProbability}%
    AQI Index: ${weather.aqi.value}, UV Index: ${weather.uvIndex}
    
    Provide weather insights in a human, calm, and trusted tone. 
    Crucially, write the response entirely in ${langName}.
    
    1. humanInsight: A friendly observation about the day.
    2. healthSuggestion: A suggestion based on UV, AQI, or temperature.
    3. travelWarning: If rain chance is high or wind is strong, provide a subtle warning.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            humanInsight: { type: Type.STRING },
            healthSuggestion: { type: Type.STRING },
            travelWarning: { type: Type.STRING },
          },
          required: ["humanInsight", "healthSuggestion", "travelWarning"],
        },
      },
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("AI Insight Error:", error);
    return {
      humanInsight: "Conditions are steady. A pleasant day to observe the surroundings.",
      healthSuggestion: "Stay mindful of your comfort and hydration today.",
      travelWarning: "No significant travel concerns detected at this moment."
    };
  }
};
