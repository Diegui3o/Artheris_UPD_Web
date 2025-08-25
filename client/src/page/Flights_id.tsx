"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type SeriesPoint = { ts: string; values: Record<string, number> };
type Summary = {
  flight_id: string;
  start_ts: string;
  end_ts: string;
  duration_sec: number;
  max_roll?: number;
  max_pitch?: number;
  throttle_time_in_range_sec: number;
  throttle_time_out_range_sec: number;
};

const DEFAULT_FIELDS = ["AngleRoll", "AnglePitch", "InputThrottle"];

export default function FlightDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = decodeURIComponent(params.id);
  const [fieldsCsv, setFieldsCsv] = useState(
    search.get("fields") ?? DEFAULT_FIELDS.join(",")
  );
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const fields = useMemo(
    () =>
      fieldsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [fieldsCsv]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          fields: fields.join(","),
          limit: "50000",
        });
        const res = await fetch(
          `/api/flights/${encodeURIComponent(id)}/series?` + qs.toString()
        );
        const data = (await res.json()) as SeriesPoint[];
        setSeries(data);
        const sum = await fetch(
          `/api/flights/${encodeURIComponent(id)}/summary`
        );
        setSummary(await sum.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [id, fields]);

  const chartData = useMemo(() => {
    return series.map((p) => ({
      ts: new Date(p.ts).toLocaleTimeString(),
      ...p.values,
    }));
  }, [series]);

  return (
    <div className="p-6 max-w-6xl mx-auto text-white space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          📈 Vuelo: <span className="font-mono">{id}</span>
        </h1>
        <div className="flex items-center gap-2">
          <input
            className="px-3 py-1.5 rounded bg-gray-800 border border-gray-700"
            value={fieldsCsv}
            onChange={(e) => setFieldsCsv(e.target.value)}
            placeholder="Campos coma-separados"
            title="Ej: AngleRoll,AnglePitch,InputThrottle"
          />
        </div>
      </div>

      {summary && (
        <div className="grid md:grid-cols-4 gap-4">
          <Stat
            label="Inicio"
            value={new Date(summary.start_ts).toLocaleString()}
          />
          <Stat label="Fin" value={new Date(summary.end_ts).toLocaleString()} />
          <Stat label="Duración (s)" value={summary.duration_sec.toFixed(2)} />
          <Stat
            label="Tiempo throttle en rango (s)"
            value={summary.throttle_time_in_range_sec.toFixed(2)}
          />
          <Stat
            label="Tiempo throttle fuera (s)"
            value={summary.throttle_time_out_range_sec.toFixed(2)}
          />
          <Stat
            label="|Max Roll|"
            value={summary.max_roll?.toFixed(2) ?? "-"}
          />
          <Stat
            label="|Max Pitch|"
            value={summary.max_pitch?.toFixed(2) ?? "-"}
          />
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        {loading ? (
          <div>Cargando serie...</div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ts" />
              <YAxis />
              <Tooltip />
              <Legend />
              {fields.map((f) => (
                <Line key={f} type="monotone" dataKey={f} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="text-gray-400 text-sm">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
