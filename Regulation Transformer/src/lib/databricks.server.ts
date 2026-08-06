const WAREHOUSE_ID = "d379ec542f3028fb";
const TABLE = "tcsai.gold.regulation_records";

function gatewayUrl() {
  const base = process.env["CONNECTOR_GATEWAY_BASE_URL"] ?? "https://connector-gateway.lovable.dev";
  return `${base.replace(/\/$/, "")}/databricks`;
}

export async function runSql(
  statement: string,
  parameters?: Array<{ name: string; value: string; type?: string }>,
): Promise<string[][]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const dbKey = process.env["DATABRICKS_API_KEY"];
  if (!lovableKey || !dbKey) throw new Error("Databricks connection is not configured");

  const res = await fetch(`${gatewayUrl()}/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": dbKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      warehouse_id: WAREHOUSE_ID,
      statement,
      wait_timeout: "30s",
      ...(parameters ? { parameters } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Databricks request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as {
    status?: { state?: string; error?: { message?: string } };
    result?: { data_array?: string[][] };
  };
  if (json.status?.state !== "SUCCEEDED") {
    throw new Error(json.status?.error?.message ?? `Databricks statement ${json.status?.state}`);
  }
  return json.result?.data_array ?? [];
}

export const REGULATION_TABLE = TABLE;
