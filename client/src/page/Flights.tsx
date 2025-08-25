"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type FlightItem = { flight_id: string; last_ts: string };

export default function FlightsPage() {
  const [loading, setLoading] = useState(true);
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/flights?limit=100");
        const data = (await res.json()) as FlightItem[];
        setFlights(data);
      } catch (e: any) {
        setErr(e?.message ?? "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto text-white space-y-6">
      <h1 className="text-2xl font-bold">🛫 Vuelos anteriores</h1>
      {loading && <div>Cargando...</div>}
      {err && <div className="text-red-400">{err}</div>}
      {!loading && !err && (
        <div className="grid gap-3">
          {flights.map((f) => (
            <Link
              key={f.flight_id}
              href={`/flights/${encodeURIComponent(f.flight_id)}`}
              className="block bg-gray-800 border border-gray-700 rounded-xl p-4 hover:bg-gray-700"
            >
              <div className="font-semibold">{f.flight_id}</div>
              <div className="text-sm text-gray-300">
                último ts: {new Date(f.last_ts).toLocaleString()}
              </div>
            </Link>
          ))}
          {!flights.length && (
            <div className="text-gray-400">No hay vuelos aún.</div>
          )}
        </div>
      )}
    </div>
  );
}
