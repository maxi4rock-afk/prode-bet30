"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Match = {
  id: string;
  phase: string;
  match_date: string | null;
  home_team: string;
  away_team: string;
  locked: boolean | null;
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

const FLAGS: Record<string, string> = {
  "México": "🇲🇽",
  "Sudáfrica": "🇿🇦",
  "Corea del Sur": "🇰🇷",
  "República Checa": "🇨🇿",
  "Canadá": "🇨🇦",
  "Bosnia": "🇧🇦",
  "Estados Unidos": "🇺🇸",
  "Paraguay": "🇵🇾",
  "Qatar": "🇶🇦",
  "Suiza": "🇨🇭",
  "Brasil": "🇧🇷",
  "Marruecos": "🇲🇦",
  "Haití": "🇭🇹",
  "Escocia": "🏴",
  "Australia": "🇦🇺",
  "Turquía": "🇹🇷",
  "Alemania": "🇩🇪",
  "Curazao": "🇨🇼",
  "Países Bajos": "🇳🇱",
  "Japón": "🇯🇵",
  "Costa de Marfil": "🇨🇮",
  "Ecuador": "🇪🇨",
  "Suecia": "🇸🇪",
  "Túnez": "🇹🇳",
  "España": "🇪🇸",
  "Cabo Verde": "🇨🇻",
  "Bélgica": "🇧🇪",
  "Egipto": "🇪🇬",
  "Arabia Saudita": "🇸🇦",
  "Uruguay": "🇺🇾",
  "Irán": "🇮🇷",
  "Nueva Zelanda": "🇳🇿",
  "Francia": "🇫🇷",
  "Senegal": "🇸🇳",
  "Irak": "🇮🇶",
  "Noruega": "🇳🇴",
  "Argentina": "🇦🇷",
  "Argelia": "🇩🇿",
  "Austria": "🇦🇹",
  "Jordania": "🇯🇴",
  "Portugal": "🇵🇹",
  "RD Congo": "🇨🇩",
  "Inglaterra": "🏴",
  "Croacia": "🇭🇷",
  "Ghana": "🇬🇭",
  "Panamá": "🇵🇦",
  "Uzbekistán": "🇺🇿",
  "Colombia": "🇨🇴",
};

function equipoConBandera(equipo: string) {
  return `${FLAGS[equipo] ?? "🏳️"} ${equipo}`;
}

export default function Home() {
  const [usuario, setUsuario] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionInput>>({});
  const [scores, setScores] = useState<Score[]>([]);
  const [rankingAbierto, setRankingAbierto] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    cargarPartidos();
    cargarRanking();

    const savedPlayerId = localStorage.getItem("playerId");
    const savedUsuario = localStorage.getItem("usuario");

    if (savedPlayerId) {
      setPlayerId(savedPlayerId);
      cargarPronosticos(savedPlayerId);
      setMensaje("✅ Sesión recuperada.");
    }

    if (savedUsuario) setUsuario(savedUsuario);
  }, []);

  const partidosPorGrupo = useMemo(() => {
    const grupos: Record<string, Match[]> = {};

    matches.forEach((match) => {
      if (!grupos[match.phase]) grupos[match.phase] = [];
      grupos[match.phase].push(match);
    });

    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  function toggleGrupo(grupo: string) {
    setGruposAbiertos((prev) => ({
      ...prev,
      [grupo]: !(prev[grupo] ?? true),
    }));
  }

  function normalizarUsuario(valor: string) {
    return String(valor || "").toLowerCase().trim().replace(/\s+/g, "");
  }

  function formatearFecha(fecha: string | null) {
    if (!fecha) return "Fecha pendiente";

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "Fecha inválida";

    const dia = date.toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const hora = date.toLocaleTimeString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${dia} - ${hora} hs`;
  }

  function partidoBloqueado(match: Match) {
    if (match.locked) return true;
    if (!match.match_date) return false;

    const fechaPartido = new Date(match.match_date);
    if (isNaN(fechaPartido.getTime())) return false;

    return fechaPartido.getTime() <= Date.now();
  }

  async function cargarPartidos() {
    const { data, error } = await supabase
      .from("matches")
      .select("id, phase, match_date, home_team, away_team, locked")
      .order("match_date", { ascending: true });

    if (error) {
      console.log("Error partidos:", error);
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
      console.log("Error ranking:", error);
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
      console.log("Error pronósticos:", error);
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

    if (!usuario) {
      setMensaje("Ingresá tu usuario BET30.");
      return;
    }

    const usuarioLimpio = normalizarUsuario(usuario);

    if (!usuarioLimpio) {
      setMensaje("Ingresá tu usuario BET30 correctamente.");
      return;
    }

    const { data: allowedUsers, error: authError } = await supabase
      .from("allowed_players")
      .select("casino_user");

    if (authError) {
      console.log("Error allowed_players:", authError);
      setMensaje("Error al validar acceso.");
      return;
    }

    const autorizado = (allowedUsers || []).some((u) => {
      return normalizarUsuario(u.casino_user) === usuarioLimpio;
    });

    if (!autorizado) {
      setMensaje("No estás habilitado para participar. Contactá con soporte.");
      return;
    }

    const { data: players, error: searchError } = await supabase
      .from("players")
      .select("id, full_name, casino_user");

    if (searchError) {
      console.log("Error buscando player:", searchError);
      setMensaje("Error al buscar usuario.");
      return;
    }

    const existingPlayer = (players || []).find((p) => {
      return normalizarUsuario(p.casino_user) === usuarioLimpio;
    });

    if (existingPlayer) {
      setPlayerId(existingPlayer.id);

      localStorage.setItem("playerId", existingPlayer.id);
      localStorage.setItem("usuario", existingPlayer.casino_user);

      setUsuario(existingPlayer.casino_user);

      await cargarPronosticos(existingPlayer.id);

      setMensaje("✅ Bienvenido nuevamente. Tus pronósticos anteriores fueron cargados.");
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        full_name: usuarioLimpio,
        casino_user: usuarioLimpio,
        paid: true,
      })
      .select("id")
      .single();

    if (error) {
      console.log("Error creando player:", error);
      setMensaje("Error al registrar.");
      return;
    }

    setPlayerId(data.id);

    localStorage.setItem("playerId", data.id);
    localStorage.setItem("usuario", usuarioLimpio);

    setUsuario(usuarioLimpio);

    setMensaje("✅ Registro exitoso. Ya podés cargar tus pronósticos.");
  }

  async function guardarPronostico(matchId: string) {
    if (!playerId) {
      setMensaje("Primero ingresá con tu usuario BET30.");
      return;
    }

    const match = matches.find((m) => m.id === matchId);

    if (!match || partidoBloqueado(match)) {
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
      console.log("Error guardando pronóstico:", error);
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
      .filter((match) => !partidoBloqueado(match))
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
      console.log("Error guardando todos:", error);
      setMensaje("Error al guardar todos los pronósticos.");
      return;
    }

    setMensaje(`✅ Se guardaron ${pronosticosParaGuardar.length} pronósticos correctamente.`);
  }

  function cerrarSesion() {
    localStorage.removeItem("playerId");
    localStorage.removeItem("usuario");
    setPlayerId(null);
    setUsuario("");
    setPredictions({});
    setMensaje("Sesión cerrada.");
  }

  return (
    <main className="min-h-screen bg-[#08080c] text-white p-4 md:p-6">
      <section className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs tracking-[0.45em] uppercase text-orange-400 mb-3">
            Prime Rock x BET30
          </p>

          <h1 className="text-4xl md:text-6xl font-black mb-3">
            🏆 Prode Mundial{" "}
            <span className="text-[#e8357a]">BET</span>
            <span className="text-[#2255ee]">30</span>
          </h1>

          <p className="text-gray-300">
            Participá con una carga mínima de{" "}
            <span className="text-orange-400 font-bold">$25.000</span>
          </p>
        </div>

        <div className="bg-[#111118] border border-[#7c3aed] p-5 md:p-6 rounded-2xl mb-6 shadow-[0_0_30px_rgba(124,58,237,0.25)]">
          <h2 className="text-xl font-black mb-2">Ingresar al Prode</h2>

          {!playerId ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Ingresá tu usuario BET30 para acceder al Prode.
              </p>

              <input
                className="w-full p-3 rounded bg-[#1b1b25] border border-zinc-700 text-white outline-none focus:ring-2 focus:ring-orange-400"
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
            </div>
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
            <p className="text-center text-orange-300 font-bold mt-4">
              {mensaje}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#111118] border border-[#7c3aed] p-5 md:p-6 rounded-2xl shadow-[0_0_25px_rgba(34,85,238,0.15)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-orange-400">🏆 Top Prode</h2>

              <button
                onClick={() => setRankingAbierto(true)}
                className="text-sm bg-[#2255ee] px-3 py-2 rounded font-bold hover:bg-[#e8357a] transition"
              >
                Ver ranking completo
              </button>
            </div>

            {scores.length === 0 && (
              <p className="text-gray-400">Todavía no hay puntos cargados.</p>
            )}

            <div className="space-y-3">
              {scores.slice(0, 3).map((score, index) => (
                <div
                  key={score.id}
                  className="bg-[#1b1b25] border border-zinc-700 p-4 rounded-xl flex justify-between"
                >
                  <div>
                    <p className="font-bold">
                      {index === 0 && "🥇 "}
                      {index === 1 && "🥈 "}
                      {index === 2 && "🥉 "}
                      {score.players?.full_name ?? "Sin nombre"}
                    </p>
                    <p className="text-sm text-gray-400">
                      {score.players?.casino_user ?? "Sin usuario"}
                    </p>
                  </div>

                  <p className="text-[#ffcc00] font-black">{score.points} pts</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111118] border border-[#e8357a] p-5 md:p-6 rounded-2xl shadow-[0_0_25px_rgba(232,53,122,0.18)]">
            <h2 className="text-xl font-black mb-4 text-[#e8357a]">🎁 Premios</h2>

            <div className="space-y-3 text-base md:text-lg">
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

            <div className="mt-6 border-t border-white/10 pt-4 text-sm">
              <h3 className="font-bold mb-2 text-orange-400">
                Sistema de puntos
              </h3>
              <p>Resultado exacto: 8 pts</p>
              <p>Ganador/empate correcto: 3 pts</p>
              <p>Diferencia de gol correcta: +2 pts</p>
            </div>
          </div>
        </div>

        <div className="bg-[#111118] border border-zinc-700 p-5 md:p-6 rounded-2xl">
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

          <div className="space-y-5">
            {partidosPorGrupo.map(([grupo, partidos]) => {
              const abierto = gruposAbiertos[grupo] ?? true;

              return (
                <div
                  key={grupo}
                  className="border border-zinc-700 rounded-2xl overflow-hidden bg-[#0f0f16]"
                >
                  <button
                    onClick={() => toggleGrupo(grupo)}
                    className="w-full flex items-center justify-between p-4 bg-[#1b1b25] hover:bg-[#242435] transition"
                  >
                    <div>
                      <p className="text-orange-400 font-black text-lg">
                        {abierto ? "▼" : "▶"} {grupo}
                      </p>
                      <p className="text-sm text-gray-400">
                        {partidos.length} partidos
                      </p>
                    </div>

                    <span className="text-[#ffcc00] font-black">
                      {abierto ? "Ocultar" : "Ver partidos"}
                    </span>
                  </button>

                  {abierto && (
                    <div className="space-y-4 p-4">
                      {partidos.map((match) => {
                        const bloqueado = partidoBloqueado(match);

                        return (
                          <div
                            key={match.id}
                            className="bg-[#1b1b25] border border-zinc-700 p-4 rounded-xl grid md:grid-cols-5 gap-3 items-center"
                          >
                            <div className="md:col-span-2">
                              <p className="text-xs text-orange-300 uppercase font-bold">
                                {match.phase}
                              </p>

                              <p className="font-black">
                                {equipoConBandera(match.home_team)} vs{" "}
                                {equipoConBandera(match.away_team)}
                              </p>

                              <p className="text-[#ffcc00] text-sm font-bold mt-1">
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
                              className="p-3 rounded bg-[#0f0f16] border border-zinc-600 text-white text-center font-black outline-none focus:ring-2 focus:ring-[#e8357a] disabled:bg-gray-700 disabled:text-gray-400"
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
                              className="p-3 rounded bg-[#0f0f16] border border-zinc-600 text-white text-center font-black outline-none focus:ring-2 focus:ring-[#2255ee] disabled:bg-gray-700 disabled:text-gray-400"
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {rankingAbierto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111118] border border-[#7c3aed] rounded-2xl p-5 md:p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-[0_0_40px_rgba(124,58,237,0.35)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-orange-400">
                🏆 Ranking completo
              </h2>

              <button
                onClick={() => setRankingAbierto(false)}
                className="bg-red-500 px-4 py-2 rounded font-bold"
              >
                Cerrar
              </button>
            </div>

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

                  <p className="text-[#ffcc00] font-black">{score.points} pts</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}