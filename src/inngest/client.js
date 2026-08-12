import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "chailm-server",
  isDev: process.env.NODE_ENV !== "production",
});