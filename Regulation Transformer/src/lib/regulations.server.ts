import { runSql, REGULATION_TABLE } from "./databricks.server";
import { chatJson } from "./ai.server";

export type RegulationRecord = {
  id: string;
  documentId: string;
  chunkId: string;
  title: string;
  agency: string;
  authority: string;
  regulation: string;
  summary: string;
};

export type TriageResult = {
  manufacturing_related: boolean;
  confidence: number;
  rationale: string;
};

export type ExtractionResult = {
  summary: string;
  obligations: string[];
  products: string[];
  business_units: string[];
  affected_areas: string[];
  risk: string;
};

function toRecord(row: string[]): RegulationRecord {
  const [documentId, chunkId, title, agency, authority, regulation, summary] = row;
  return {
    id: `${documentId ?? ""}::${chunkId ?? ""}`,
    documentId: documentId ?? "",
    chunkId: chunkId ?? "",
    title: title ?? "",
    agency: agency ?? "",
    authority: authority ?? "",
    regulation: regulation ?? "",
    summary: summary ?? "",
  };
}

export async function fetchRecords(limit: number, search: string): Promise<RegulationRecord[]> {
  const where = search
    ? "WHERE lower(coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(agency,'') || ' ' || coalesce(regulation,'')) LIKE :q"
    : "";
  const rows = await runSql(
    `SELECT document_id, CAST(chunk_id AS STRING), coalesce(title,''), coalesce(agency,''),
            coalesce(authority,''), coalesce(regulation,''), coalesce(summary,'')
     FROM ${REGULATION_TABLE} ${where}
     ORDER BY document_id, chunk_id LIMIT ${Math.min(Math.max(limit, 1), 200)}`,
    search ? [{ name: "q", value: `%${search.toLowerCase()}%`, type: "STRING" }] : undefined,
  );
  return rows.map(toRecord);
}

async function fetchOne(id: string): Promise<RegulationRecord> {
  const [documentId, chunkId] = id.split("::");
  const rows = await runSql(
    `SELECT document_id, CAST(chunk_id AS STRING), coalesce(title,''), coalesce(agency,''),
            coalesce(authority,''), coalesce(regulation,''), coalesce(summary,'')
     FROM ${REGULATION_TABLE}
     WHERE document_id = :doc AND CAST(chunk_id AS STRING) = :chunk LIMIT 1`,
    [
      { name: "doc", value: documentId ?? "", type: "STRING" },
      { name: "chunk", value: chunkId ?? "", type: "STRING" },
    ],
  );
  if (!rows.length) throw new Error("Regulation record not found");
  return toRecord(rows[0]!);
}

export async function triage(id: string) {
  const r = await fetchOne(id);
  const result = await chatJson<TriageResult>(
    `You are a regulatory Triage Agent for a manufacturing enterprise (engines, powertrain, vehicles, industrial equipment).
Decide whether a regulation is relevant to manufacturing operations, products, emissions, safety, materials, supply chain or plant compliance.
Respond ONLY with JSON: {"manufacturing_related": boolean, "confidence": number between 0 and 1, "rationale": "one or two sentences"}.`,
    `Title: ${r.title}\nAgency: ${r.agency}\nRegulation: ${r.regulation}\nSummary: ${r.summary}`,
  );
  return { record: r, result };
}

export async function extract(id: string) {
  const r = await fetchOne(id);
  const result = await chatJson<ExtractionResult>(
    `You are a Knowledge Extraction Agent turning regulations into enterprise actions.
Respond ONLY with JSON of shape:
{"summary": string, "obligations": string[], "products": string[], "business_units": string[], "affected_areas": string[], "risk": "Low" | "Medium" | "High"}.
Obligations must be concrete, actionable compliance statements. Products are affected product lines or model families (empty array if unknown).
Business units are internal owners such as Engine, Powertrain, Manufacturing, Quality, Legal. Affected areas are impacted functions or processes. Keep each item under 200 characters.`,
    `Document ID: ${r.documentId}\nTitle: ${r.title}\nAgency: ${r.agency}\nAuthority: ${r.authority}\nRegulation: ${r.regulation}\nSummary: ${r.summary}`,
  );
  return {
    record: r,
    result: {
      summary: result.summary ?? "",
      obligations: result.obligations ?? [],
      products: result.products ?? [],
      business_units: result.business_units ?? [],
      affected_areas: result.affected_areas ?? [],
      risk: result.risk ?? "Unknown",
    },
  };
}
