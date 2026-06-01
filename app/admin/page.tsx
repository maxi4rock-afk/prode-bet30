"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Match = {
  id: string;
  phase: string;
  home_team: string;
  away_team: string;
  real_home_goals: number | null;
  real_away_goals: number | null;
};

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarPartidos();
  }, []);

  async function cargarPartidos() {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: true });

    if (error) {
      console.log(error);
      setMensaje("Error al cargar partidos.");
      return;
    }

    setMatches(data || []);
  }

  async function guardarResultado(match: Match) {
    const { error } = await supabase
      .from("matches")
      .update({
        real_home_goals: match.real_home_goals,
        real_away_goals: match.real_away_goals,
      })
      .eq("id", match.id);

    if (error) {
      console.log(error);
      setMensaje("Error al guardar resultado.");
      return;
    }

    setMensaje("✅ Resultado guardado.");
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <section className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Panel Admin BET30</h1>

        {mensaje && <p className="text-green-400 font-bold mb-4">{mensaje}</p>}

        <div className="space-y-4">
          {matches.map((match) => (
            <div key={match.id} className="bg-zinc-900 p-4 rounded-xl grid md:grid-cols-5 gap-3 items-center">
              <div className="md:col-span-2">
                <p className="text-sm text-gray-400">{match.phase}</p>
                <p className="font-bold">
                  {match.home_team} vs {match.away_team}
                </p>
              </div>

              <input
                className="p-3 rounded bg-white text-black text-center"
                type="number"
                placeholder={match.home_team}
                value={match.real_home_goals ?? ""}
                onChange={(e) =>
                  setMatches((prev) =>
                    prev.map((m) =>
                      m.id === match.id
                        ? { ...m, real_home_goals: Number(e.target.value) }
                        : m
                    )
                  )
                }
              />

              <input
                className="p-3 rounded bg-white text-black text-center"
                type="number"
                placeholder={match.away_team}
                value={match.real_away_goals ?? ""}
                onChange={(e) =>
                  setMatches((prev) =>
                    prev.map((m) =>
                      m.id === match.id
                        ? { ...m, real_away_goals: Number(e.target.value) }
                        : m
                    )
                  )
                }
              />

              <button
                onClick={() => guardarResultado(match)}
                className="bg-yellow-500 text-black font-bold p-3 rounded"
              >
                Guardar resultado
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}