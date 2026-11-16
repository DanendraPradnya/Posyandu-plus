import { serve } from "inngest/next";
import { inngest, processKiaExtractionJobFn } from "@/lib/extraction/inngest-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processKiaExtractionJobFn],
});

