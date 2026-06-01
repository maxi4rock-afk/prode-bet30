"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Match = {
  id: string;
  phase: string;
  match_date: string;
  home_team: string;
  away_team: string;
};

type Score = {
  id: string;
  points: number;
  players: {
    full_name: string;
    casino_user: string;
  };
};

type PredictionInput = {
  home: string;
  away: string;
};

export default function Home() {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [usuario, setUsuario] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionInput>>({});
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    cargarPartidos();
    cargarRanking();

    const savedPlayerId = localStorage.getItem("playerId");
    const savedNombre = localStorage.getItem("nombre");
    const savedUsuario = localStorage.getItem("usuario");

    if (savedPlayerId) setPlayerId(savedPlayerId);
    if (savedNombre) setNombre(savedNombre);
    if (savedUsuario) setUsuario(savedUsuario);
  }, []);

  async function cargarPartidos() {
    const { data, error } = await supabase
      .from("matches")
      .select("id, phase, match_date, home_team, away_team")
      .order("match_date", { ascending: true });

    if (error) {
      console.log(error);
      setMensaje("Error al cargar partidos.");
      return;
    }

    setMatches(data ?? []);
  }

  async function cargarRanking() {
    const { data, error } = await supabase
      .from("scores")
      .select(`
        id,
        points,
        players (
          full_name,
          casino_user
        )
      `)
      .order("points", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

const formattedScores: Score[] = (data || []).map((item: any) => ({
  id: item.id,
  points: item.points,
  players: Array.isArray(item.players) ? item.players[0] : item.players,
}));

setScores(formattedScores);

  async function registrarse() {
    setMensaje("");

    if (!nombre || !whatsapp || !usuario) {
      setMensaje("Completá todos los campos.");
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        full_name: nombre,
        whatsapp,
        casino_user: usuario,
        paid: true,
      })
      .select("id")
      .single();

    if (error) {
      console.log(error);
      setMensaje("Error al registrar. Revisá Supabase.");
      return;
    }

    setPlayerId(data.id);
    localStorage.setItem("playerId", data.id);
    localStorage.setItem("nombre", nombre);
    localStorage.setItem("usuario", usuario);

    setMensaje("✅ Inscripción realizada. Ya podés cargar tus pronósticos.");
  }

  async function guardarPronostico(matchId: string) {
    if (!playerId) {
      setMensaje("Primero tenés que inscribirte.");
      return;
    }

    const pred = predictions[matchId];

    if (!pred || pred.home === "" || pred.away === "") {
      setMensaje("Completá los goles del partido.");
      return;
    }

    const { error } = await supabase.from("predictions").upsert(
      {
        player_id: playerId,
        match_id: matchId,
        predicted_home_goals: Number(pred.home),
        predicted_away_goals: Number(pred.away),
      },
      {
        onConflict: "player_id,match_id",
      }
    );

    if (error) {
      console.log(error);
      setMensaje("Error al guardar pronóstico.");
      return;
    }

    setMensaje("✅ Pronóstico guardado/actualizado correctamente.");
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <section className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-4">🏆 Prode Mundial BET30</h1>
          <p className="text-xl text-gray-300">
            Participá con una carga mínima de $25.000
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 p-6 rounded-2xl space-y-4">
            <h2 className="text-2xl font-bold">Inscripción</h2>

            <input className="w-full p-3 rounded bg-white text-black" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <input className="w-full p-3 rounded bg-white text-black" placeholder="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            <input className="w-full p-3 rounded bg-white text-black" placeholder="Usuario BET30" value={usuario} onChange={(e) => setUsuario(e.target.value)} />

            <button onClick={registrarse} className="w-full bg-yellow-500 text-black font-bold p-3 rounded">
              Inscribirme
            </button>

            {mensaje && <p className="text-center text-green-400 font-bold">{mensaje}</p>}
          </div>

          <div className="bg-zinc-900 p-6 rounded-2xl">
            <h2 className="text-2xl font-bold mb-4">Premios</h2>
            <p>🥇 1° Puesto: $700.000</p>
            <p>🥈 2° Puesto: $200.000</p>
            <p>🥉 3° Puesto: $100.000</p>

            <div className="mt-6 border-t border-zinc-700 pt-4">
              <h3 className="font-bold mb-2">Puntos</h3>
              <p>Resultado exacto: 8 pts</p>
              <p>Ganador/empate correcto: 3 pts</p>
              <p>Diferencia de gol correcta: +2 pts</p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-zinc-900 p-6 rounded-2xl">
          <h2 className="text-2xl font-bold mb-4">🏆 Ranking</h2>

          {scores.length === 0 && (
            <p className="text-gray-400">Todavía no hay puntos cargados.</p>
          )}

          <div className="space-y-3">
            {scores.map((score, index) => (
              <div key={score.id} className="bg-zinc-800 p-4 rounded-xl flex justify-between">
                <div>
                  <p className="font-bold">
                    #{index + 1} {score.players?.full_name}
                  </p>
                  <p className="text-sm text-gray-400">
                    {score.players?.casino_user}
                  </p>
                </div>
                <p className="text-yellow-400 font-bold">{score.points} pts</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-zinc-900 p-6 rounded-2xl">
          <h2 className="text-2xl font-bold mb-4">Fixture y pronósticos</h2>

          {matches.length === 0 && <p className="text-gray-400">No hay partidos cargados.</p>}

          <div className="space-y-4">
            {matches.map((match) => (
              <div key={match.id} className="bg-zinc-800 p-4 rounded-xl grid md:grid-cols-5 gap-3 items-center">
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-400">{match.phase}</p>
                  <p className="font-bold">{match.home_team} vs {match.away_team}</p>
                </div>

                <input
                  className="p-3 rounded bg-white text-black text-center"
                  type="number"
                  placeholder={match.home_team}
                  value={predictions[match.id]?.home ?? ""}
                  onChange={(e) =>
                    setPredictions((prev) => ({
                      ...prev,
                      [match.id]: {
                        home: e.target.value,
                        away: prev[match.id]?.away ?? "",
                      },
                    }))
                  }
                />

                <input
                  className="p-3 rounded bg-white text-black text-center"
                  type="number"
                  placeholder={match.away_team}
                  value={predictions[match.id]?.away ?? ""}
                  onChange={(e) =>
                    setPredictions((prev) => ({
                      ...prev,
                      [match.id]: {
                        home: prev[match.id]?.home ?? "",
                        away: e.target.value,
                      },
                    }))
                  }
                />

                <button onClick={() => guardarPronostico(match.id)} className="bg-yellow-500 text-black font-bold p-3 rounded">
                  Guardar
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}