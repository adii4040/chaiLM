import OpenAI from "openai";
import { config } from "../config/env.js";

export const gemini = new OpenAI({
  apiKey: config.gemini.apiKey,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
