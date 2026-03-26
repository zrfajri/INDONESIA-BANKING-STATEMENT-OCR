import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: "Inflow" | "Outflow";
  category: string;
}

export async function extractTransactions(images: { data: string; mimeType: string }[]): Promise<Transaction[]> {
  const parts = images.map((img) => ({
    inlineData: {
      data: img.data,
      mimeType: img.mimeType,
    },
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: {
      parts: [
        {
          text: "Extract all financial transactions from these Indonesian bank statements (credit card or savings account). Return a JSON array of objects. For each transaction, provide the date (YYYY-MM-DD), description, amount (as a positive number), type ('Inflow' or 'Outflow'), and auto-detect a category based on the description (e.g., 'Groceries', 'Dining', 'Utilities', 'Transfer', 'Salary', 'Entertainment', 'Shopping', etc.). Ignore non-transaction text like headers, footers, or summary balances. Ensure amounts are parsed correctly (Indonesian format often uses '.' for thousands and ',' for decimals, or vice versa depending on the bank).",
        },
        ...parts,
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description: "The date of the transaction in YYYY-MM-DD format.",
            },
            description: {
              type: Type.STRING,
              description: "The description or details of the transaction.",
            },
            amount: {
              type: Type.NUMBER,
              description: "The amount of the transaction as a positive number.",
            },
            type: {
              type: Type.STRING,
              enum: ["Inflow", "Outflow"],
              description: "Whether the transaction is an inflow (credit/deposit) or outflow (debit/withdrawal).",
            },
            category: {
              type: Type.STRING,
              description: "The auto-detected category of the transaction.",
            },
          },
          required: ["date", "description", "amount", "type", "category"],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse Gemini response:", e);
    return [];
  }
}
