"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Match = {
  id: string;
  phase: string;
  match_date: string | null;
  home_team: string;
  away_team: string;
};

type Score = {
  id: string;
  points: number;
  players: {
    full_name: string;
    casino_user: string;
  } | null;
};

type PredictionInput = {
  home: string;
  away: string;
};

export default function Home() {
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
    const savedWhatsapp = localStorage.getItem("whatsapp");
    const savedUsuario = localStorage.getItem("usuario");

    if (savedPlayerId) {
      setPlayerId(savedPlayerId);
      cargarPronosticos(savedPlayerId);
      setMensaje("✅ Sesión recuperada.");
    }

    if (savedWhatsapp) setWhatsapp(savedWhatsapp);
    if (savedUsuario) setUsuario(savedUsuario);
  }, []);

  function normalizarUsuario(valor: string) {
    return valor.toLowerCase().replace(/\s+/g, "");
  }

  function normalizarWhatsapp(valor: string) {
    return valor.replace(/\D/g, "");
  }

  function formatearFecha(fecha: string | null) {
    if (!fecha) return "Fecha pendiente";

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "Fecha inválida";

    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function partidoBloqueado(fecha: string | null) {
    if (!fecha) return false;

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return false;

    return date.getTime() <= Date.now();
  }

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
      .from("score")
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
  }

  async function cargarPronosticos(idJugador: string) {
    const { data, error } = await supabase
      .from("predictions")
      .select("match_id, predicted_home_goals, predicted_away_goals")
      .eq("player_id", idJugador);

    if (error) {
      console.log(error);
      return;
    }

    const loaded: Record<string, PredictionInput> = {};

    (data || []).forEach((pred) => {
      loaded[pred.match_id] = {
        home: String(pred.predicted_home_goals),
        away: String(pred.predicted_away_goals),
      };
    });

    setPredictions(loaded);
  }

  async function registrarse() {
    setMensaje("");

    if (!whatsapp || !usuario) {
      setMensaje("Completá usuario BET30 y WhatsApp.");
      return;
    }

    const usuarioLimpio = normalizarUsuario(usuario);
    const whatsappLimpio = normalizarWhatsapp(whatsapp);

    if (!usuarioLimpio || !whatsappLimpio) {
      setMensaje("Completá usuario BET30 y WhatsApp correctamente.");
      return;
    }

    const { data: autorizado, error: authError } = await supabase
      .from("allowed_players")
      .select("casino_user")
      .eq("casino_user", usuarioLimpio)
      .maybeSingle();

    if (authError) {
      console.log(authError);
      setMensaje("Error al validar acceso.");
      return;
    }

    if (!autorizado) {
      setMensaje("No estás habilitado para participar. Contactá con soporte.");
      return;
    }

    const { data: existingPlayer, error: searchError } = await supabase
      .from("players")
      .select("id, casino_user, whatsapp")
      .eq("casino_user", usuarioLimpio)
      .maybeSingle();

    if (searchError) {
      console.log(searchError);
      setMensaje("Error al buscar usuario.");
      return;
    }

    if (existingPlayer) {
      setPlayerId(existingPlayer.id);

      localStorage.setItem("playerId", existingPlayer.id);
      localStorage.setItem("usuario", existingPlayer.casino_user);
      localStorage.setItem("whatsapp", existingPlayer.whatsapp || "");

      setUsuario(existingPlayer.casino_user);
      setWhatsapp(existingPlayer.whatsapp || whatsappLimpio);

      await cargarPronosticos(existingPlayer.id);

      setMensaje("✅ Bienvenido nuevamente. Tus pronósticos anteriores fueron cargados.");
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        full_name: usuarioLimpio,
        whatsapp: whatsappLimpio,
        casino_user: usuarioLimpio,
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
    localStorage.setItem("usuario", usuarioLimpio);
    localStorage.setItem("whatsapp", whatsappLimpio);

    setUsuario(usuarioLimpio);
    setWhatsapp(whatsappLimpio);

    setMensaje("✅ Inscripción realizada. Ya podés cargar tus pronósticos.");
  }

  async function guardarPronostico(matchId: string) {
    if (!playerId) {
      setMensaje("Primero ingresá con tu usuario BET30.");
      return;
    }

    const match = matches.find((m) => m.id === matchId);

    if (partidoBloqueado(match?.match_date ?? null)) {
      setMensaje("🔒 Este partido ya está cerrado.");
      return;
    }

    const pred = predictions[matchId];

    if (!pred || pred.home === "" || pred.away === "") {
      setMensaje("Completá los goles del partido.");
      return;
    }

    if (Number(pred.home) < 0 || Number(pred.away) < 0) {
      setMensaje("Los goles no pueden ser negativos.");
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

    setMensaje("✅ Pronóstico guardado correctamente.");
  }

  async function guardarTodosLosPronosticos() {
    if (!playerId) {
      setMensaje("Primero ingresá con tu usuario BET30.");
      return;
    }

    const pronosticosParaGuardar = matches
      .filter((match) => !partidoBloqueado(match.match_date))
      .filter((match) => {
        const pred = predictions[match.id];

        return (
          pred &&
          pred.home !== "" &&
          pred.away !== "" &&
          Number(pred.home) >= 0 &&
          Number(pred.away) >= 0
        );
      })
      .map((match) => ({
        player_id: playerId,
        match_id: match.id,
        predicted_home_goals: Number(predictions[match.id].home),
        predicted_away_goals: Number(predictions[match.id].away),
      }));

    if (pronosticosParaGuardar.length === 0) {
      setMensaje("No hay pronósticos completos para guardar.");
      return;
    }

    const { error } = await supabase.from("predictions").upsert(
      pronosticosParaGuardar,
      {
        onConflict: "player_id,match_id",
      }
    );

    if (error) {
      console.log(error);
      setMensaje("Error al guardar todos los pronósticos.");
      return;
    }

    setMensaje(`✅ Se guardaron ${pronosticosParaGuardar.length} pronósticos correctamente.`);
  }

  function cerrarSesion() {
    localStorage.clear();
    setPlayerId(null);
    setWhatsapp("");
    setUsuario("");
    setPredictions({});
    setMensaje("Sesión cerrada.");
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white p-6">
      <section className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-sm tracking-[0.35em] uppercase text-orange-400 mb-3">
            Prime Rock x BET30
          </p>

          <h1 className="text-5xl md:text-6xl font-black mb-4">
            🏆 Prode Mundial{" "}
            <span className="text-[#e8357a]">BET</span>
            <span className="text-[#2255ee]">30</span>
          </h1>

          <p className="text-xl text-gray-300">
            Participá con una carga mínima de{" "}
            <span className="text-orange-400 font-bold">$25.000</span>
          </p>
        </div>

        <div className="bg-gradient-to-r from-[#120826] via-[#1e0b42] to-[#14141f] border border-[#2a0f5e] p-6 rounded-2xl space-y-4 mb-8 shadow-[0_0_35px_rgba(232,53,122,0.18)]">
          <h2 className="text-2xl font-bold">Ingresar al Prode</h2>

          {!playerId ? (
            <>
              <input
                className="w-full p-3 rounded bg-white text-black outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Número de WhatsApp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />

              <input
                className="w-full p-3 rounded bg-white text-black outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Usuario BET30"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />

              <button
                onClick={registrarse}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-black p-3 rounded hover:scale-[1.01] transition"
              >
                Ingresar
              </button>
            </>
          ) : (
            <div className="text-center">
              <p className="text-green-400 font-bold">
                ✅ Conectado como {usuario}
              </p>

              <button
                onClick={cerrarSesion}
                className="mt-4 w-full bg-red-500 text-white font-bold p-3 rounded"
              >
                Cerrar sesión
              </button>
            </div>
          )}

          {mensaje && (
            <p className="text-center text-orange-300 font-bold">{mensaje}</p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#111118] border border-[#2a0f5e] p-6 rounded-2xl shadow-[0_0_25px_rgba(34,85,238,0.15)]">
            <h2 className="text-2xl font-black mb-4 text-orange-400">
              🏆 Ranking
            </h2>

            {scores.length === 0 && (
              <p className="text-gray-400">Todavía no hay puntos cargados.</p>
            )}

            <div className="space-y-3">
              {scores.map((score, index) => (
                <div
                  key={score.id}
                  className="bg-[#1b1b25] border border-zinc-700 p-4 rounded-xl flex justify-between"
                >
                  <div>
                    <p className="font-bold">
                      #{index + 1} {score.players?.full_name ?? "Sin nombre"}
                    </p>
                    <p className="text-sm text-gray-400">
                      {score.players?.casino_user ?? "Sin usuario"}
                    </p>
                  </div>

                  <p className="text-[#ffcc00] font-black">
                    {score.points} pts
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#120826] via-[#1e0b42] to-[#111118] border border-[#e8357a]/40 p-6 rounded-2xl shadow-[0_0_25px_rgba(232,53,122,0.18)]">
            <h2 className="text-2xl font-black mb-4 text-[#e8357a]">
              🎁 Premios
            </h2>

            <div className="space-y-3 text-lg">
              <p>
                🥇 1° Puesto:{" "}
                <span className="font-bold text-[#ffcc00]">$700.000</span>
              </p>
              <p>
                🥈 2° Puesto:{" "}
                <span className="font-bold text-[#ffcc00]">$200.000</span>
              </p>
              <p>
                🥉 3° Puesto:{" "}
                <span className="font-bold text-[#ffcc00]">$100.000</span>
              </p>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="font-bold mb-2 text-orange-400">
                Sistema de puntos
              </h3>
              <p>Resultado exacto: 8 pts</p>
              <p>Ganador/empate correcto: 3 pts</p>
              <p>Diferencia de gol correcta: +2 pts</p>
            </div>
          </div>
        </div>

        <div className="bg-[#111118] border border-zinc-800 p-6 rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <h2 className="text-2xl font-black">Fixture y pronósticos</h2>

            <button
              onClick={guardarTodosLosPronosticos}
              className="bg-gradient-to-r from-[#e8357a] to-[#2255ee] text-white font-black px-5 py-3 rounded hover:scale-[1.02] transition"
            >
              Guardar todos
            </button>
          </div>

          {matches.length === 0 && (
            <p className="text-gray-400">No hay partidos cargados.</p>
          )}

          <div className="space-y-4">
            {matches.map((match) => {
              const bloqueado = partidoBloqueado(match.match_date);

              return (
                <div
                  key={match.id}
                  className="bg-[#1b1b25] border border-zinc-700 p-4 rounded-xl grid md:grid-cols-5 gap-3 items-center"
                >
                  <div className="md:col-span-2">
                    <p className="text-sm text-orange-300">{match.phase}</p>

                    <p className="font-bold">
                      {match.home_team} vs {match.away_team}
                    </p>

                    <p className="text-[#ffcc00] font-bold mt-1">
                      🕒 {formatearFecha(match.match_date)}
                    </p>

                    {bloqueado && (
                      <p className="text-red-400 text-sm mt-1">
                        🔒 Pronóstico cerrado
                      </p>
                    )}
                  </div>

                  <input
                    disabled={bloqueado}
                    className="p-3 rounded bg-white text-black text-center outline-none focus:ring-2 focus:ring-[#e8357a] disabled:bg-gray-400"
                    type="number"
                    min="0"
                    placeholder="Local"
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
                    disabled={bloqueado}
                    className="p-3 rounded bg-white text-black text-center outline-none focus:ring-2 focus:ring-[#2255ee] disabled:bg-gray-400"
                    type="number"
                    min="0"
                    placeholder="Visitante"
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

                  <button
                    disabled={bloqueado}
                    onClick={() => guardarPronostico(match.id)}
                    className={`font-black p-3 rounded ${
                      bloqueado
                        ? "bg-gray-600 text-white cursor-not-allowed"
                        : "bg-orange-500 text-black hover:bg-yellow-400"
                    }`}
                  >
                    {bloqueado ? "🔒 Cerrado" : "Guardar"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}