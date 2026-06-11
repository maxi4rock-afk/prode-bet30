"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function ingresar() {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!adminPassword) { setError("Falta configurar la contraseña admin."); return; }
    if (password === adminPassword) { sessionStorage.setItem("admin_auth", "true"); onLogin(); return; }
    setError("Contraseña incorrecta.");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 border border-yellow-500">
        <h1 className="text-3xl font-black mb-2">🔐 Admin BET30</h1>
        <p className="text-gray-400 mb-4">Ingresá la contraseña para acceder al panel.</p>
        <input type="password" placeholder="Contraseña admin" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ingresar(); }}
          className="w-full rounded bg-white p-3 text-black mb-3" />
        <button onClick={ingresar} className="w-full rounded bg-yellow-500 p-3 font-bold text-black">Ingresar</button>
        {error && <p className="mt-4 text-center font-bold text-red-400">{error}</p>}
      </div>
    </main>
  );
}

type Match = {
  id: string; phase: string; match_date: string | null;
  home_team: string; away_team: string;
  real_home_goals: number | null; real_away_goals: number | null;
  locked: boolean;
  odd_home: number | null; odd_draw: number | null; odd_away: number | null;
};

type Prediction = {
  player_id: string; match_id: string;
  predicted_home_goals: number; predicted_away_goals: number;
};

type RankingRow = {
  id: number; player_id: string; points: number;
  players?: { full_name: string | null; casino_user: string | null; } | null;
};

type ChampionStat = { champion: string; count: number; };

type Standing = {
  id?: string; group_name: string; team: string;
  played: number; won: number; drawn: number; lost: number;
  goals_for: number; goals_against: number; points: number;
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
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const GRUPOS = ["Grupo A","Grupo B","Grupo C","Grupo D","Grupo E","Grupo F","Grupo G","Grupo H","Grupo I","Grupo J","Grupo K","Grupo L"];

export default function AdminPage() {
  const [adminAutorizado, setAdminAutorizado] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [campeonReal, setCampeonReal] = useState("");
  const [guardandoCampeon, setGuardandoCampeon] = useState(false);
  const [championStats, setChampionStats] = useState<ChampionStat[]>([]);
  const [reseteandoCampeones, setReseteandoCampeones] = useState(false);

  // Standings state
  const [standings, setStandings] = useState<Standing[]>([]);
  const [sGrupo, setSGrupo] = useState("Grupo A");
  const [sEquipo, setSEquipo] = useState("");
  const [sPJ, setSPJ] = useState("0");
  const [sG, setSG] = useState("0");
  const [sE, setSE] = useState("0");
  const [sP, setSP] = useState("0");
  const [sGF, setSGF] = useState("0");
  const [sGC, setSGC] = useState("0");
  const [sPts, setSPts] = useState("0");
  const [cargandoStanding, setCargandoStanding] = useState(false);
  const [standingsTab, setStandingsTab] = useState("Grupo A");

  useEffect(() => {
    const auth = sessionStorage.getItem("admin_auth");
    if (auth === "true") {
      setAdminAutorizado(true);
      cargarTodo();
    }
  }, []);

  async function cargarTodo() {
    cargarPartidos(); cargarRanking(); cargarCampeonReal();
    cargarCampeonesElegidos(); cargarStandings();
  }

  const completedMatches = matches.filter(m => m.real_home_goals !== null && m.real_away_goals !== null).length;

  async function cargarPartidos() {
    const { data, error } = await supabase.from("matches").select("*").order("match_date", { ascending: true });
    if (error) { setMensaje("Error al cargar partidos."); return; }
    setMatches((data || []) as Match[]);
  }

  async function cargarRanking() {
    const { data, error } = await supabase.from("score")
      .select("id, player_id, points, players ( full_name, casino_user )")
      .order("points", { ascending: false });
    if (error) { setMensaje("Error al cargar ranking."); return; }
    setRanking((data || []).map((row: any) => ({
      id: row.id, player_id: row.player_id, points: row.points,
      players: Array.isArray(row.players) ? row.players[0] : row.players,
    })));
  }

  async function cargarCampeonReal() {
    const { data } = await supabase.from("tournament_config").select("champion").eq("id", 1).maybeSingle();
    if (data?.champion) setCampeonReal(data.champion);
  }

  async function cargarCampeonesElegidos() {
    const { data, error } = await supabase.from("champion_predictions").select("champion");
    if (error) return;
    const conteo: Record<string, number> = {};
    (data || []).forEach((row) => { if (row.champion) conteo[row.champion] = (conteo[row.champion] || 0) + 1; });
    setChampionStats(Object.entries(conteo).map(([champion, count]) => ({ champion, count })).sort((a, b) => b.count - a.count));
  }

  async function cargarStandings() {
    const { data } = await supabase.from("standings").select("*").order("group_name").order("points", { ascending: false });
    setStandings(data || []);
  }

  async function guardarStanding() {
    if (!sGrupo || !sEquipo.trim()) { setMensaje("Completá grupo y equipo."); return; }
    setCargandoStanding(true);
    const row = {
      group_name: sGrupo, team: sEquipo.trim(),
      played: Number(sPJ), won: Number(sG), drawn: Number(sE), lost: Number(sP),
      goals_for: Number(sGF), goals_against: Number(sGC), points: Number(sPts),
      updated_at: new Date().toISOString(),
    };
    const existing = standings.find(s => s.group_name === sGrupo && s.team === sEquipo.trim());
    if (existing?.id) {
      await supabase.from("standings").update(row).eq("id", existing.id);
    } else {
      await supabase.from("standings").insert(row);
    }
    await cargarStandings();
    setSEquipo(""); setSPJ("0"); setSG("0"); setSE("0"); setSP("0"); setSGF("0"); setSGC("0"); setSPts("0");
    setCargandoStanding(false);
    setMensaje("✅ Posición guardada correctamente.");
  }

  function cargarParaEditar(s: Standing) {
    setSGrupo(s.group_name); setSEquipo(s.team);
    setSPJ(String(s.played)); setSG(String(s.won)); setSE(String(s.drawn)); setSP(String(s.lost));
    setSGF(String(s.goals_for)); setSGC(String(s.goals_against)); setSPts(String(s.points));
    setMensaje(`Editando: ${s.team} (${s.group_name})`);
  }

  async function eliminarStanding(id: string) {
    await supabase.from("standings").delete().eq("id", id);
    await cargarStandings();
    setMensaje("✅ Equipo eliminado.");
  }

  async function limpiarGrupo(groupName: string) {
    if (!confirm(`¿Borrar toda la tabla del ${groupName}?`)) return;
    await supabase.from("standings").delete().eq("group_name", groupName);
    await cargarStandings();
    setMensaje(`✅ Tabla del ${groupName} limpiada.`);
  }

  function entrarAdmin() {
    setAdminAutorizado(true);
    cargarTodo();
  }

  async function recalcularStandings(groupName: string) {
    // Traer todos los partidos del grupo con resultado cargado
    const { data: partidos } = await supabase
      .from("matches")
      .select("home_team, away_team, real_home_goals, real_away_goals")
      .eq("phase", groupName)
      .not("real_home_goals", "is", null)
      .not("real_away_goals", "is", null);

    if (!partidos || partidos.length === 0) {
      // Si no hay resultados, limpiar la tabla del grupo
      await supabase.from("standings").delete().eq("group_name", groupName);
      await cargarStandings();
      return;
    }

    // Calcular stats por equipo
    const stats: Record<string, { played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number }> = {};

    function initTeam(team: string) {
      if (!stats[team]) stats[team] = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 };
    }

    partidos.forEach((p) => {
      const hg = p.real_home_goals as number;
      const ag = p.real_away_goals as number;
      initTeam(p.home_team);
      initTeam(p.away_team);

      stats[p.home_team].played++;
      stats[p.away_team].played++;
      stats[p.home_team].goals_for += hg;
      stats[p.home_team].goals_against += ag;
      stats[p.away_team].goals_for += ag;
      stats[p.away_team].goals_against += hg;

      if (hg > ag) {
        stats[p.home_team].won++; stats[p.home_team].points += 3;
        stats[p.away_team].lost++;
      } else if (hg < ag) {
        stats[p.away_team].won++; stats[p.away_team].points += 3;
        stats[p.home_team].lost++;
      } else {
        stats[p.home_team].drawn++; stats[p.home_team].points++;
        stats[p.away_team].drawn++; stats[p.away_team].points++;
      }
    });

    // Borrar standings actuales del grupo y reinsertar
    await supabase.from("standings").delete().eq("group_name", groupName);

    const rows = Object.entries(stats).map(([team, s]) => ({
      group_name: groupName,
      team,
      ...s,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      await supabase.from("standings").insert(rows);
    }

    await cargarStandings();
  }

  async function guardarCuotas(match: Match) {
    setGuardandoId(match.id); setMensaje("");
    const { error } = await supabase.from("matches").update({
      odd_home: match.odd_home,
      odd_draw: match.odd_draw,
      odd_away: match.odd_away,
    }).eq("id", match.id);
    setGuardandoId(null);
    if (error) { setMensaje("Error al guardar cuotas."); return; }
    setMensaje("✅ Cuotas guardadas.");
    await cargarPartidos();
  }

  async function guardarResultado(match: Match) {
    setGuardandoId(match.id); setMensaje("");
    const { error } = await supabase.from("matches").update({
      real_home_goals: match.real_home_goals, real_away_goals: match.real_away_goals, locked: true,
    }).eq("id", match.id);
    setGuardandoId(null);
    if (error) { setMensaje("Error al guardar resultado."); return; }
    await cargarPartidos();
    await recalcularStandings(match.phase);
    setMensaje("✅ Resultado guardado. Tabla de posiciones actualizada.");
  }

  async function toggleBloqueo(match: Match) {
    setGuardandoId(match.id); setMensaje("");
    const { error } = await supabase.from("matches").update({ locked: !match.locked }).eq("id", match.id);
    setGuardandoId(null);
    if (error) { setMensaje("Error al cambiar bloqueo."); return; }
    setMensaje(match.locked ? "🔓 Partido desbloqueado." : "🔒 Partido bloqueado.");
    await cargarPartidos();
  }

  async function resetearResultado(matchId: string) {
    if (!confirm("¿Resetear este partido?")) return;
    setGuardandoId(matchId); setMensaje("");
    const match = matches.find(m => m.id === matchId);
    await supabase.from("matches").update({ real_home_goals: null, real_away_goals: null, locked: false }).eq("id", matchId);
    setGuardandoId(null);
    await cargarPartidos();
    if (match) await recalcularStandings(match.phase);
    setMensaje("✅ Resultado reseteado. Tabla de posiciones actualizada.");
  }

  async function resetearTodosLosResultados() {
    if (!confirm("¿Borrar todos los resultados y desbloquear todos los partidos?")) return;
    setMensaje("Reseteando...");
    await supabase.from("matches").update({ real_home_goals: null, real_away_goals: null, locked: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("standings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await cargarPartidos();
    await cargarStandings();
    setMensaje("✅ Todos los resultados reseteados. Tablas de posiciones limpiadas.");
  }

  async function resetearRanking() {
    if (!confirm("¿Dejar el ranking en 0?")) return;
    setMensaje("Reseteando ranking...");
    await supabase.from("score").update({ points: 0, updated_at: new Date().toISOString() }).neq("id", -1);
    setMensaje("✅ Ranking reseteado a 0.");
    await cargarRanking();
  }

  async function resetearCampeonesElegidos() {
    if (!confirm("¿Borrar todos los campeones elegidos por los usuarios?")) return;
    setReseteandoCampeones(true);
    await supabase.from("champion_predictions").delete().neq("player_id", "00000000-0000-0000-0000-000000000000");
    setReseteandoCampeones(false);
    setChampionStats([]);
    setMensaje("✅ Campeones elegidos reseteados.");
  }

  async function guardarCampeonReal() {
    setGuardandoCampeon(true);
    const { error } = await supabase.from("tournament_config").update({ champion: campeonReal, updated_at: new Date().toISOString() }).eq("id", 1);
    setGuardandoCampeon(false);
    if (error) { setMensaje("Error al guardar campeón."); return; }
    setMensaje("🏆 Campeón real guardado.");
    await cargarCampeonesElegidos();
  }

  function calcularPuntos(pred: Prediction, match: Match) {
    if (match.real_home_goals === null || match.real_away_goals === null) return 0;
    const rH = match.real_home_goals, rA = match.real_away_goals;
    const pH = pred.predicted_home_goals, pA = pred.predicted_away_goals;
    if (pH === rH && pA === rA) return 8;
    const rRes = rH > rA ? "home" : rH < rA ? "away" : "draw";
    const pRes = pH > pA ? "home" : pH < pA ? "away" : "draw";
    let pts = 0;
    if (rRes === pRes) pts += 3;
    if ((rH - rA) === (pH - pA)) pts += 2;
    return pts;
  }

  async function calcularRanking() {
    setCalculando(true); setMensaje("Calculando ranking...");
    const { data: matchesData, error: mErr } = await supabase.from("matches").select("*").not("real_home_goals", "is", null).not("real_away_goals", "is", null);
    if (mErr) { setMensaje("Error al leer resultados."); setCalculando(false); return; }
    const { data: predsData, error: pErr } = await supabase.from("predictions").select("player_id, match_id, predicted_home_goals, predicted_away_goals");
    if (pErr) { setMensaje("Error al leer pronósticos."); setCalculando(false); return; }
    const { data: config } = await supabase.from("tournament_config").select("champion").eq("id", 1).single();
    const campeonOficial = config?.champion;
    const puntos: Record<string, number> = {};
    (predsData || []).forEach((pred) => {
      const match = (matchesData || []).find((m) => m.id === pred.match_id);
      if (!match) return;
      puntos[pred.player_id] = (puntos[pred.player_id] || 0) + calcularPuntos(pred as Prediction, match as Match);
    });
    if (campeonOficial) {
      const { data: champPreds } = await supabase.from("champion_predictions").select("player_id, champion");
      (champPreds || []).forEach((pred) => {
        if (pred.champion === campeonOficial) puntos[pred.player_id] = (puntos[pred.player_id] || 0) + 15;
      });
    }
    const rows = Object.entries(puntos).map(([player_id, points]) => ({ player_id, points, updated_at: new Date().toISOString() }));
    await supabase.from("score").delete().neq("id", -1);
    if (rows.length > 0) await supabase.from("score").insert(rows);
    await cargarRanking();
    setMensaje("🏆 Ranking calculado correctamente.");
    setCalculando(false);
  }

  const standingsDelGrupo = standings.filter(s => s.group_name === standingsTab).sort((a, b) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against));
  const gruposConDatos = [...new Set(standings.map(s => s.group_name))].sort();

  if (!adminAutorizado) return <AdminLogin onLogin={entrarAdmin} />;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-yellow-400">Administración</p>
            <h1 className="text-4xl font-bold">Panel Admin BET30</h1>
            <p className="mt-2 text-gray-300">Resultados cargados: {completedMatches} de {matches.length}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={resetearTodosLosResultados} className="rounded bg-red-600 px-5 py-3 font-bold text-white">Resetear resultados</button>
            <button onClick={resetearRanking} className="rounded bg-zinc-700 px-5 py-3 font-bold text-white">Ranking a 0</button>
            <button onClick={resetearCampeonesElegidos} disabled={reseteandoCampeones} className="rounded bg-purple-700 px-5 py-3 font-bold text-white disabled:bg-gray-600">
              {reseteandoCampeones ? "Reseteando..." : "Reset campeones"}
            </button>
            <button onClick={calcularRanking} disabled={calculando} className="rounded bg-yellow-500 px-5 py-3 font-bold text-black disabled:bg-gray-600 disabled:text-white">
              {calculando ? "Calculando..." : "Calcular ranking"}
            </button>
          </div>
        </div>

        {/* CAMPEÓN */}
        <div className="mb-6 rounded bg-zinc-900 p-5 border border-yellow-500">
          <h2 className="text-2xl font-bold text-yellow-400 mb-3">🏆 Campeón Mundial</h2>
          <div className="flex gap-3 flex-wrap">
            <input value={campeonReal} onChange={(e) => setCampeonReal(e.target.value)} placeholder="Ej: Argentina" className="rounded bg-white p-3 text-black flex-1 min-w-[250px]" />
            <button onClick={guardarCampeonReal} disabled={guardandoCampeon} className="rounded bg-yellow-500 px-5 py-3 font-bold text-black">
              {guardandoCampeon ? "Guardando..." : "Guardar campeón"}
            </button>
          </div>
          {campeonReal && <p className="mt-3 text-green-400 font-bold">Campeón configurado: {campeonReal}</p>}
        </div>

        {/* CAMPEONES ELEGIDOS */}
        <div className="mb-6 rounded bg-zinc-900 p-5 border border-purple-500">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-purple-300">⭐ Campeones elegidos por usuarios</h2>
              <p className="mt-1 text-sm text-gray-400">Esto controla el bloque público de "Más elegidos".</p>
            </div>
            <button onClick={resetearCampeonesElegidos} disabled={reseteandoCampeones} className="rounded bg-purple-700 px-5 py-3 font-bold text-white disabled:bg-gray-600">
              {reseteandoCampeones ? "Reseteando..." : "Resetear campeones elegidos"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {championStats.length === 0 ? (
              <p className="text-sm text-gray-400">Todavía no hay campeones elegidos.</p>
            ) : (
              championStats.map((stat, index) => (
                <div key={stat.champion} className="flex items-center justify-between rounded bg-black/40 p-3 border border-zinc-700">
                  <p className="font-bold">#{index + 1} {stat.champion}</p>
                  <p className="font-black text-yellow-400">{stat.count}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── STANDINGS ── */}
        <div className="mb-6 rounded bg-zinc-900 p-5 border border-green-500">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold text-green-400">📊 Tablas de posiciones</h2>
              <p className="text-sm text-gray-400 mt-1">Se actualizan automáticamente al guardar resultados.</p>
            </div>
            <button onClick={() => { if (confirm("¿Limpiar todas las tablas?")) { supabase.from("standings").delete().neq("id","00000000-0000-0000-0000-000000000000").then(() => cargarStandings()); setMensaje("✅ Tablas limpiadas."); } }}
              className="rounded bg-red-800 px-4 py-2 text-sm font-bold text-white">
              Limpiar todas
            </button>
          </div>

          {/* Vista de tablas por grupo */}
          <div>
            <div className="flex gap-2 flex-wrap mb-4">
              {gruposConDatos.length === 0 ? (
                <p className="text-sm text-gray-400">No hay datos de standings cargados aún.</p>
              ) : (
                gruposConDatos.map(g => (
                  <button key={g} onClick={() => setStandingsTab(g)} className={`px-4 py-2 rounded text-sm font-bold ${standingsTab === g ? "bg-green-500 text-black" : "bg-zinc-700 text-white"}`}>
                    {g}
                  </button>
                ))
              )}
            </div>

            {standingsDelGrupo.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-green-400">{standingsTab}</h3>
                  <button onClick={() => limpiarGrupo(standingsTab)} className="text-xs text-red-400 hover:text-red-300 font-bold">
                    Limpiar grupo
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-zinc-700">
                        <th className="text-left py-2 pr-4">Equipo</th>
                        <th className="text-center py-2 px-2">PJ</th>
                        <th className="text-center py-2 px-2">G</th>
                        <th className="text-center py-2 px-2">E</th>
                        <th className="text-center py-2 px-2">P</th>
                        <th className="text-center py-2 px-2">GF</th>
                        <th className="text-center py-2 px-2">GC</th>
                        <th className="text-center py-2 px-2">DG</th>
                        <th className="text-center py-2 px-2 text-yellow-400">Pts</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {standingsDelGrupo.map((s, i) => (
                        <tr key={s.id} className={`border-b border-zinc-800 ${i === 0 ? "bg-green-900/20" : i === 1 ? "bg-green-900/10" : ""}`}>
                          <td className="py-2 pr-4 font-bold">{i + 1}. {s.team}</td>
                          <td className="text-center py-2 px-2">{s.played}</td>
                          <td className="text-center py-2 px-2">{s.won}</td>
                          <td className="text-center py-2 px-2">{s.drawn}</td>
                          <td className="text-center py-2 px-2">{s.lost}</td>
                          <td className="text-center py-2 px-2">{s.goals_for}</td>
                          <td className="text-center py-2 px-2">{s.goals_against}</td>
                          <td className="text-center py-2 px-2">{s.goals_for - s.goals_against}</td>
                          <td className="text-center py-2 px-2 font-black text-yellow-400">{s.points}</td>
                          <td className="py-2 px-2">
                            <div className="flex gap-2">
                              <button onClick={() => cargarParaEditar(s)} className="text-xs text-blue-400 font-bold">Editar</button>
                              <button onClick={() => s.id && eliminarStanding(s.id)} className="text-xs text-red-400 font-bold">X</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {mensaje && <p className="mb-4 rounded bg-zinc-900 p-3 font-bold text-green-400">{mensaje}</p>}

        {/* RESULTADOS + RANKING */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Resultados reales</h2>
            {matches.map((match) => (
              <div key={match.id} className="rounded bg-zinc-900 p-4 space-y-3">
                {/* Info del partido */}
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm text-gray-400">{match.phase}</p>
                    <p className="font-bold">{match.home_team} vs {match.away_team}</p>
                    <p className="mt-1 text-sm font-bold text-yellow-400">🕒 {formatearFechaArgentina(match.match_date)}</p>
                    <p className={`mt-1 text-sm font-bold ${match.locked ? "text-red-400" : "text-green-400"}`}>
                      {match.locked ? "🔒 Bloqueado" : "🔓 Abierto"}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => toggleBloqueo(match)} disabled={guardandoId === match.id || calculando}
                      className={`rounded px-3 py-2 text-sm font-bold ${match.locked ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
                      {match.locked ? "Desbloquear" : "Bloquear"}
                    </button>
                    <button onClick={() => resetearResultado(match.id)} disabled={guardandoId === match.id || calculando}
                      className="rounded bg-zinc-700 px-3 py-2 text-sm font-bold text-white">Reset</button>
                  </div>
                </div>

                {/* Resultado real */}
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs font-bold uppercase text-gray-500 w-full">Resultado real</p>
                  <input className="rounded bg-white p-2 text-center text-black w-24" type="number" min="0" placeholder={match.home_team}
                    value={match.real_home_goals ?? ""}
                    onChange={(e) => setMatches(prev => prev.map(item => item.id === match.id ? { ...item, real_home_goals: parseGoalValue(e.target.value) } : item))} />
                  <span className="text-gray-400 font-bold">—</span>
                  <input className="rounded bg-white p-2 text-center text-black w-24" type="number" min="0" placeholder={match.away_team}
                    value={match.real_away_goals ?? ""}
                    onChange={(e) => setMatches(prev => prev.map(item => item.id === match.id ? { ...item, real_away_goals: parseGoalValue(e.target.value) } : item))} />
                  <button onClick={() => guardarResultado(match)} disabled={guardandoId === match.id || calculando}
                    className="rounded bg-yellow-500 px-4 py-2 text-sm font-bold text-black disabled:bg-gray-600 disabled:text-white">
                    {guardandoId === match.id ? "..." : "Guardar resultado"}
                  </button>
                </div>

                {/* Cuotas */}
                <div className="flex items-center gap-3 flex-wrap border-t border-zinc-700 pt-3">
                  <p className="text-xs font-bold uppercase text-gray-500 w-full">Cuotas (1 · X · 2)</p>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500">Local</span>
                    <input className="rounded bg-white p-2 text-center text-black w-20" type="number" min="1" step="0.01" placeholder="1.00"
                      value={match.odd_home ?? ""}
                      onChange={(e) => setMatches(prev => prev.map(item => item.id === match.id ? { ...item, odd_home: e.target.value ? Number(e.target.value) : null } : item))} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500">Empate</span>
                    <input className="rounded bg-white p-2 text-center text-black w-20" type="number" min="1" step="0.01" placeholder="1.00"
                      value={match.odd_draw ?? ""}
                      onChange={(e) => setMatches(prev => prev.map(item => item.id === match.id ? { ...item, odd_draw: e.target.value ? Number(e.target.value) : null } : item))} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500">Visitante</span>
                    <input className="rounded bg-white p-2 text-center text-black w-20" type="number" min="1" step="0.01" placeholder="1.00"
                      value={match.odd_away ?? ""}
                      onChange={(e) => setMatches(prev => prev.map(item => item.id === match.id ? { ...item, odd_away: e.target.value ? Number(e.target.value) : null } : item))} />
                  </div>
                  <button onClick={() => guardarCuotas(match)} disabled={guardandoId === match.id || calculando}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:bg-gray-600 self-end">
                    {guardandoId === match.id ? "..." : "Guardar cuotas"}
                  </button>
                </div>
              </div>
            ))}
          </section>

          <aside>
            <h2 className="mb-4 text-2xl font-bold">Ranking</h2>
            <div className="space-y-3">
              {ranking.map((score, index) => (
                <div key={score.id} className="flex items-center justify-between rounded bg-zinc-900 p-4">
                  <div>
                    <p className="font-bold">#{index + 1} {score.players?.full_name || score.players?.casino_user}</p>
                    <p className="text-sm text-gray-400">{score.players?.casino_user}</p>
                  </div>
                  <p className="font-bold text-yellow-400">{score.points} pts</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
