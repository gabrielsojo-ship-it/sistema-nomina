import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage } from "../types";

// Safely access process.env.API_KEY, falling back to empty string to prevent crash if undefined.
// Note: In Vite/Vercel, process.env.API_KEY should be replaced by build time define or accessed via import.meta.env
// adhering to the guideline to use process.env.API_KEY:
const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || '';

const ai = new GoogleGenAI({ apiKey });

/**
 * Chat with Gemini 3 Pro Preview
 */
export const sendChatMessage = async (
  history: ChatMessage[],
  newMessage: string,
  contextData: string
): Promise<string> => {
  try {
    const systemInstruction = `Eres 'Personal Manager AI', un experto en RRHH. 
    Eres útil, profesional y conciso.
    Tienes acceso a los siguientes datos anónimos del equipo: ${contextData}.
    Responde preguntas sobre gestión, análisis de datos o asistencia.`;

    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: systemInstruction,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const result: GenerateContentResponse = await chat.sendMessage({ message: newMessage });
    return result.text || "No pude generar una respuesta.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Error de conexión con IA.";
  }
};

/**
 * Analyze Data for Insights
 */
export const analyzeData = async (dataContext: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analiza estos datos de RRHH y dame 3 puntos clave estratégicos sobre riesgo de rotación, balance de turnos o distribución de antigüedad. Usa viñetas. Datos: ${dataContext}`,
    });
    return response.text || "Sin análisis.";
  } catch (error) {
    console.error("Analysis Error:", error);
    return "No se pudo analizar en este momento.";
  }
};