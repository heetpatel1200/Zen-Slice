import { GoogleGenAI } from "@google/genai";
import { GameStats } from "../types";

const initGenAI = () => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateSenseiFeedback = async (stats: GameStats): Promise<string> => {
  const ai = initGenAI();
  if (!ai) return "The Dojo is silent (API Key missing).";

  try {
    const prompt = `
      You are a wise, mystical Fruit Ninja Sensei. A student has just finished training.
      
      Here are their stats:
      - Score: ${stats.score}
      - Max Combo: ${stats.maxCombo}
      - Fruits Sliced: ${stats.fruitsSliced}
      - Bombs Hit: ${stats.bombsHit}
      
      Provide a brief, 2-sentence response.
      The first sentence should be a mystical observation about their performance style.
      The second sentence should be a specific, actionable tip or a funny remark about fruit.
      Don't use markdown. Keep it plain text.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Focus your mind, and the fruit will reveal its path.";
  } catch (error) {
    console.error("Sensei is meditating (Error):", error);
    return "Even masters stumble. Try again.";
  }
};