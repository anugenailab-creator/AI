import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchRecords, triage, extract } from "./regulations.server";

export const listRegulations = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().default(25), search: z.string().default("") }).parse(data),
  )
  .handler(async ({ data }) => fetchRecords(data.limit, data.search));

export const runTriage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => triage(data.id));

export const runExtraction = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => extract(data.id));
