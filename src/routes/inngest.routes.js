import { serve } from "inngest/express";
import { inngest } from "../inngest/client.js";
import { functions } from "../inngest/functions/index.js";

export const inngestRouter = serve({
  client: inngest,
  functions,
});

export default inngestRouter;
