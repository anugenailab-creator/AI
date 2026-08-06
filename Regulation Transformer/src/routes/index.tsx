import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Factory, Loader2, Search, ShieldAlert } from "lucide-react";

import { listRegulations, runTriage, runExtraction } from "@/lib/regulations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Regulation to Enterprise Actions | Agent Console" },
      {
        name: "description",
        content:
          "Triage regulations for manufacturing relevance and extract obligations, affected areas and risk from Databricks records.",
      },
      { property: "og:title", content: "Regulation to Enterprise Actions" },
      {
        property: "og:description",
        content: "Two-agent pipeline turning regulatory records into enterprise obligations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Chips({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function Index() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const list = useServerFn(listRegulations);
  const triageFn = useServerFn(runTriage);
  const extractFn = useServerFn(runExtraction);

  const records = useQuery({
    queryKey: ["regulations", query],
    queryFn: () => list({ data: { limit: 40, search: query } }),
  });

  const triage = useMutation({ mutationFn: (id: string) => triageFn({ data: { id } }) });
  const extraction = useMutation({ mutationFn: (id: string) => extractFn({ data: { id } }) });

  const run = async (id: string) => {
    setSelected(id);
    extraction.reset();
    const t = await triage.mutateAsync(id);
    if (t.result.manufacturing_related) extraction.mutate(id);
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Databricks · tcsai.gold.regulation_records
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Changing requirements to enterprise actions
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The Triage Agent decides if a regulation is manufacturing related. If it is, the
            Knowledge Extraction Agent returns obligations, affected areas, products and risk.
          </p>
        </header>

        <form
          className="mb-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search regulations, agency, summary…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="space-y-3">
            {records.isLoading && (
              <p className="text-sm text-muted-foreground">Loading regulation records…</p>
            )}
            {records.error && (
              <p className="text-sm text-destructive">{(records.error as Error).message}</p>
            )}
            {records.data?.map((r) => (
              <article
                key={r.id}
                className={`rounded-lg border bg-card p-4 transition-colors ${
                  selected === r.id ? "border-primary" : "border-border"
                }`}
              >
                <h2 className="text-sm font-semibold text-card-foreground">{r.title || "Untitled"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.agency || "Unknown agency"}
                  {r.regulation ? ` · ${r.regulation}` : ""}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.summary}</p>
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={triage.isPending && selected === r.id}
                  onClick={() => run(r.id)}
                >
                  {triage.isPending && selected === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Run agents
                </Button>
              </article>
            ))}
            {records.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No records matched that search.</p>
            )}
          </section>

          <section className="space-y-4 lg:sticky lg:top-10 lg:self-start">
            {!selected && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Select a regulation and run the agents to see results.
              </div>
            )}

            {triage.error && (
              <p className="text-sm text-destructive">{(triage.error as Error).message}</p>
            )}

            {triage.data && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Factory className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-card-foreground">Triage Agent</h3>
                  <Badge variant={triage.data.result.manufacturing_related ? "default" : "secondary"}>
                    {triage.data.result.manufacturing_related
                      ? "Manufacturing related"
                      : "Not manufacturing"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{triage.data.result.rationale}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confidence: {Math.round((triage.data.result.confidence ?? 0) * 100)}%
                </p>
              </div>
            )}

            {extraction.isPending && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Knowledge Extraction Agent working…
              </div>
            )}

            {extraction.error && (
              <p className="text-sm text-destructive">{(extraction.error as Error).message}</p>
            )}

            {extraction.data && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Knowledge Extraction Agent
                  </h3>
                  <Badge
                    variant={extraction.data.result.risk === "High" ? "destructive" : "secondary"}
                  >
                    Risk: {extraction.data.result.risk}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{extraction.data.result.summary}</p>
                <Chips label="Obligations" items={extraction.data.result.obligations} />
                <Chips label="Affected areas" items={extraction.data.result.affected_areas} />
                <Chips label="Products" items={extraction.data.result.products} />
                <Chips label="Business units" items={extraction.data.result.business_units} />
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">JSON output</summary>
                  <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    {JSON.stringify(extraction.data.result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
