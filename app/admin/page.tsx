"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function ingresar() {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

    if (!adminPassword) {
      setError("Falta configurar la contraseña admin.");
      return;
    }

    if (password === adminPassword) {
      sessionStorage.setItem("admin_auth", "true");
      onLogin();
      return;
    }

    setError("Contraseña incorrecta.");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 border border-yellow-500">
        <h1 className="text-3xl font-black mb-2">🔐 Admin BET30</h1>
        <p className="text-gray-400 mb-4">
          Ingresá la contraseña para acceder al panel.
        </p>

        <input
          type="password"
          placeholder="Contraseña admin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ingresar();
          }}
          className="w-full rounded bg-white p-3 text-black mb-3"
        />

        <button
          onClick={ingresar}
          className="w-full rounded bg-yellow-500 p-3 font-bold text-black"
        >
          Ingresar
        </button>

        {error && (
          <p className="mt-4 text-center font-bold text-red-400">{error}</p>
        )}
      </div>
    </main>
  );
}

type Match = {
  id: string;
  phase: string;
  match_date: string | null;
  home_team: string;
  away_team: string;
  real_home_goals: number | null;
  real_away_goals: number | null;
  locked: boolean;
};

type Prediction = {
  player_id: string;
  match_id: string;
  predicted_home_goals: number;
  predicted_away_goals: number;
};

type RankingRow = {
  id: number;
  player_id: string;
  points: number;
  players?: {
    full_name: string | null;
    casino_user: string | null;
  } | null;
};

function parseGoalValue(value: string) {
  if (value === "") return null;
  return Number(value);
}

function formatearFechaArgentina(fecha: string | null) {
  if (!fecha) return "Fecha pendiente";

  const date = new Date(fecha);
  if (isNaN(date.getTime())) return "Fecha inválida";

  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [adminAutorizado, setAdminAutorizado] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [campeonReal, setCampeonReal] = useState("");
  const [guardandoCampeon, setGuardandoCampeon] = useState(false);

  useEffect(() => {
    const auth = sessionStorage.getItem("admin_auth");

    if (auth === "true") {
      setAdminAutorizado(true);
      cargarPartidos();
      cargarRanking();
      cargarCampeonReal();
    }
  }, []);

  const completedMatches = matches.filter(
    (m) => m.real_home_goals !== null && m.real_away_goals !== null
  ).length;

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

    setMatches((data || []) as Match[]);
  }

  async function cargarRanking() {
    const { data, error } = await supabase
      .from("score")
      .select(`
        id,
        player_id,
        points,
        players (
          full_name,
          casino_user
        )
      `)
      .order("points", { ascending: false });

    if (error) {
      console.log(error);
      setMensaje("Error al cargar ranking.");
      return;
    }
    

    const formatted = (data || []).map((row: any) => ({
      id: row.id,
      player_id: row.player_id,
      points: row.points,
      players: Array.isArray(row.players) ? row.players[0] : row.players,
    }));

    setRanking(formatted);
  }
async function cargarCampeonReal() {
  const { data } = await supabase
    .from("tournament_config")
    .select("champion")
    .eq("id", 1)
    .maybeSingle();

  if (data?.champion) {
    setCampeonReal(data.champion);
  }
}

  function entrarAdmin() {
    setAdminAutorizado(true);
    cargarPartidos();
    cargarRanking();
  }

  async function guardarResultado(match: Match) {
    setGuardandoId(match.id);
    setMensaje("");

    const { error } = await supabase
      .from("matches")
      .update({
        real_home_goals: match.real_home_goals,
        real_away_goals: match.real_away_goals,
        locked: true,
      })
      .eq("id", match.id);

    setGuardandoId(null);

    if (error) {
      console.log(error);
      setMensaje("Error al guardar resultado.");
      return;
    }

    setMensaje("✅ Resultado guardado y partido bloqueado.");
    await cargarPartidos();
  }

  async function toggleBloqueo(match: Match) {
    setGuardandoId(match.id);
    setMensaje("");

    const { error } = await supabase
      .from("matches")
      .update({
        locked: !match.locked,
      })
      .eq("id", match.id);

    setGuardandoId(null);

    if (error) {
      console.log(error);
      setMensaje("Error al cambiar bloqueo.");
      return;
    }

    setMensaje(match.locked ? "🔓 Partido desbloqueado." : "🔒 Partido bloqueado.");
    await cargarPartidos();
  }

  async function resetearResultado(matchId: string) {
    const confirmar = confirm("¿Seguro que querés resetear este partido?");
    if (!confirmar) return;

    setGuardandoId(matchId);
    setMensaje("");

    const { error } = await supabase
      .from("matches")
      .update({
        real_home_goals: null,
        real_away_goals: null,
        locked: false,
      })
      .eq("id", matchId);

    setGuardandoId(null);

    if (error) {
      console.log(error);
      setMensaje("Error al resetear resultado.");
      return;
    }

    setMensaje("✅ Resultado reseteado y partido desbloqueado.");
    await cargarPartidos();
  }

  async function resetearTodosLosResultados() {
    const confirmar = confirm(
      "¿Seguro que querés borrar todos los resultados y desbloquear todos los partidos?"
    );

    if (!confirmar) return;

    setMensaje("Reseteando resultados...");

    const { error } = await supabase
      .from("matches")
      .update({
        real_home_goals: null,
        real_away_goals: null,
        locked: false,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      console.log(error);
      setMensaje("Error al resetear todos los resultados.");
      return;
    }

    setMensaje("✅ Todos los resultados fueron reseteados.");
    await cargarPartidos();
  }

  async function resetearRanking() {
    const confirmar = confirm("¿Seguro que querés dejar el ranking en 0?");
    if (!confirmar) return;

    setMensaje("Reseteando ranking...");

    const { error } = await supabase
      .from("score")
      .update({
        points: 0,
        updated_at: new Date().toISOString(),
      })
      .neq("id", -1);

    if (error) {
      console.log(error);
      setMensaje("Error al resetear ranking.");
      return;
    }

    setMensaje("✅ Ranking reseteado a 0.");
    await cargarRanking();
  }
async function guardarCampeonReal() {
  setGuardandoCampeon(true);

  const { error } = await supabase
    .from("tournament_config")
    .update({
      champion: campeonReal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  setGuardandoCampeon(false);

  if (error) {
    console.log(error);
    setMensaje("Error al guardar campeón.");
    return;
  }

  setMensaje("🏆 Campeón real guardado.");
}
  function calcularPuntos(pred: Prediction, match: Match) {
    if (match.real_home_goals === null || match.real_away_goals === null) {
      return 0;
    }

    const realHome = match.real_home_goals;
    const realAway = match.real_away_goals;
    const predHome = pred.predicted_home_goals;
    const predAway = pred.predicted_away_goals;

    if (predHome === realHome && predAway === realAway) {
      return 8;
    }

    const realDiff = realHome - realAway;
    const predDiff = predHome - predAway;

    const realResult =
      realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";

    const predResult =
      predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";

    let puntos = 0;

    if (realResult === predResult) puntos += 3;
    if (realDiff === predDiff) puntos += 2;

    return puntos;
  }

  async function calcularRanking() {
    setCalculando(true);
    setMensaje("Calculando ranking...");

    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .not("real_home_goals", "is", null)
      .not("real_away_goals", "is", null);

    if (matchesError) {
      console.log(matchesError);
      setMensaje("Error al leer resultados.");
      setCalculando(false);
      return;
    }

    const { data: predictionsData, error: predictionsError } = await supabase
      .from("predictions")
      .select("player_id, match_id, predicted_home_goals, predicted_away_goals");

    if (predictionsError) {
      console.log(predictionsError);
      setMensaje("Error al leer pronósticos.");
      setCalculando(false);
      return;
    }

    const puntosPorJugador: Record<string, number> = {};
    const { data: config } = await supabase
    .from("tournament_config")
    .select("champion")
   .eq("id", 1)
   .single();

const campeonOficial = config?.champion;
    (predictionsData || []).forEach((pred) => {
      const match = (matchesData || []).find((m) => m.id === pred.match_id);
      if (!match) return;

      const puntos = calcularPuntos(pred as Prediction, match as Match);

      puntosPorJugador[pred.player_id] =
        (puntosPorJugador[pred.player_id] || 0) + puntos;
    });
  if (campeonOficial) {
  const { data: championPredictions } = await supabase
    .from("champion_predictions")
    .select("player_id, champion");

  (championPredictions || []).forEach((pred) => {
    if (pred.champion === campeonOficial) {
      puntosPorJugador[pred.player_id] =
        (puntosPorJugador[pred.player_id] || 0) + 15;
    }
  });
}
    const rows = Object.entries(puntosPorJugador).map(([player_id, points]) => ({
      player_id,
      points,
      updated_at: new Date().toISOString(),
    }));

    const { error: deleteError } = await supabase
      .from("score")
      .delete()
      .neq("id", -1);

    if (deleteError) {
      console.log(deleteError);
      setMensaje("Error al limpiar ranking.");
      setCalculando(false);
      return;
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("score").insert(rows);

      if (insertError) {
        console.log(insertError);
        setMensaje("Error al crear puntajes.");
        setCalculando(false);
        return;
      }
    }

    await cargarRanking();

    setMensaje("🏆 Ranking calculado correctamente.");
    setCalculando(false);
  }

  if (!adminAutorizado) {
    return <AdminLogin onLogin={entrarAdmin} />;
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-yellow-400">
              Administración
            </p>
            <h1 className="text-4xl font-bold">Panel Admin BET30</h1>
            <p className="mt-2 text-gray-300">
              Resultados cargados: {completedMatches} de {matches.length}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={resetearTodosLosResultados}
              className="rounded bg-red-600 px-5 py-3 font-bold text-white"
            >
              Resetear resultados
            </button>

            <button
              onClick={resetearRanking}
              className="rounded bg-zinc-700 px-5 py-3 font-bold text-white"
            >
              Ranking a 0
            </button>

            <button
              onClick={calcularRanking}
              disabled={calculando}
              className="rounded bg-yellow-500 px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-white"
            >
              {calculando ? "Calculando..." : "Calcular ranking"}
            </button>
          </div>
        </div>
<div className="mb-6 rounded bg-zinc-900 p-5 border border-yellow-500">
  <h2 className="text-2xl font-bold text-yellow-400 mb-3">
    🏆 Campeón Mundial
  </h2>

  <div className="flex gap-3 flex-wrap">
    <input
      value={campeonReal}
      onChange={(e) => setCampeonReal(e.target.value)}
      placeholder="Ej: Argentina"
      className="rounded bg-white p-3 text-black flex-1 min-w-[250px]"
    />

    <button
      onClick={guardarCampeonReal}
      disabled={guardandoCampeon}
      className="rounded bg-yellow-500 px-5 py-3 font-bold text-black"
    >
      {guardandoCampeon ? "Guardando..." : "Guardar campeón"}
    </button>
  </div>

  {campeonReal && (
    <p className="mt-3 text-green-400 font-bold">
      Campeón configurado: {campeonReal}
    </p>
  )}
</div>
        {mensaje && (
          <p className="mb-4 rounded bg-zinc-900 p-3 font-bold text-green-400">
            {mensaje}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Resultados reales</h2>

            {matches.map((match) => (
              <div
                key={match.id}
                className="grid gap-3 rounded bg-zinc-900 p-4 md:grid-cols-7 md:items-center"
              >
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-400">{match.phase}</p>
                  <p className="font-bold">
                    {match.home_team} vs {match.away_team}
                  </p>
                  <p className="mt-1 text-sm font-bold text-yellow-400">
                    🕒 {formatearFechaArgentina(match.match_date)}
                  </p>
                  <p
                    className={`mt-1 text-sm font-bold ${
                      match.locked ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {match.locked ? "🔒 Bloqueado" : "🔓 Abierto"}
                  </p>
                </div>

                <input
                  className="rounded bg-white p-3 text-center text-black"
                  type="number"
                  min="0"
                  placeholder={match.home_team}
                  value={match.real_home_goals ?? ""}
                  onChange={(event) =>
                    setMatches((prev) =>
                      prev.map((item) =>
                        item.id === match.id
                          ? {
                              ...item,
                              real_home_goals: parseGoalValue(event.target.value),
                            }
                          : item
                      )
                    )
                  }
                />

                <input
                  className="rounded bg-white p-3 text-center text-black"
                  type="number"
                  min="0"
                  placeholder={match.away_team}
                  value={match.real_away_goals ?? ""}
                  onChange={(event) =>
                    setMatches((prev) =>
                      prev.map((item) =>
                        item.id === match.id
                          ? {
                              ...item,
                              real_away_goals: parseGoalValue(event.target.value),
                            }
                          : item
                      )
                    )
                  }
                />

                <button
                  onClick={() => guardarResultado(match)}
                  disabled={guardandoId === match.id || calculando}
                  className="rounded bg-yellow-500 p-3 font-bold text-black disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-white"
                >
                  {guardandoId === match.id ? "..." : "Guardar"}
                </button>

                <button
                  onClick={() => toggleBloqueo(match)}
                  disabled={guardandoId === match.id || calculando}
                  className={`rounded p-3 font-bold ${
                    match.locked
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {match.locked ? "Desbloquear" : "Bloquear"}
                </button>

                <button
                  onClick={() => resetearResultado(match.id)}
                  disabled={guardandoId === match.id || calculando}
                  className="rounded bg-zinc-700 p-3 font-bold text-white"
                >
                  Reset
                </button>
              </div>
            ))}
          </section>

          <aside>
            <h2 className="mb-4 text-2xl font-bold">Ranking</h2>

            <div className="space-y-3">
              {ranking.map((score, index) => (
                <div
                  key={score.id}
                  className="flex items-center justify-between rounded bg-zinc-900 p-4"
                >
                  <div>
                    <p className="font-bold">
                      #{index + 1}{" "}
                      {score.players?.full_name || score.players?.casino_user}
                    </p>
                    <p className="text-sm text-gray-400">
                      {score.players?.casino_user}
                    </p>
                  </div>
                  <p className="font-bold text-yellow-400">
                    {score.points} pts
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}