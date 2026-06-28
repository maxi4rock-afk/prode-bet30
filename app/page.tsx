"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Match = {
  id: string; phase: string; match_date: string | null;
  home_team: string; away_team: string;
  locked: boolean | null;
  real_home_goals: number | null; real_away_goals: number | null;
  odd_home: number | null; odd_draw: number | null; odd_away: number | null;
  force_unlocked: boolean | null;
};

type Score = { id: string; points: number; players: { full_name: string; casino_user: string; } | null; };
type PredictionInput = { home: string; away: string; };
type ChampionStat = { champion: string; count: number; };
type Standing = { id: string; group_name: string; team: string; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number; };
type Toast = { id: number; message: string; type: "success" | "error"; };

const WORLD_CUP_2030_LOGO = "/trophy-hero.png";
const BET30_LOGO = "/bet30-logo.png";
const TOTAL_PARTIDOS = 88; // 72 grupos + 16 eliminatorias

const FLAG_CODES: Record<string, string> = {
  México: "mx", Sudáfrica: "za", "Corea del Sur": "kr", "República Checa": "cz",
  Canadá: "ca", Bosnia: "ba", "Estados Unidos": "us", Paraguay: "py", Qatar: "qa",
  Suiza: "ch", Brasil: "br", Marruecos: "ma", Haití: "ht", Escocia: "gb",
  Australia: "au", Turquía: "tr", Alemania: "de", Curazao: "cw", "Países Bajos": "nl",
  Japón: "jp", "Costa de Marfil": "ci", Ecuador: "ec", Suecia: "se", Túnez: "tn",
  España: "es", "Cabo Verde": "cv", Bélgica: "be", Egipto: "eg", "Arabia Saudita": "sa",
  Uruguay: "uy", Irán: "ir", "Nueva Zelanda": "nz", Francia: "fr", Senegal: "sn",
  Irak: "iq", Noruega: "no", Argentina: "ar", Argelia: "dz", Austria: "at",
  Jordania: "jo", Portugal: "pt", "RD Congo": "cd", Inglaterra: "gb", Croacia: "hr",
  Ghana: "gh", Panamá: "pa", Uzbekistán: "uz", Colombia: "co",
};

const TEAMS = Object.keys(FLAG_CODES).sort((a, b) => a.localeCompare(b));

function BanderaEquipo({ equipo, size = "md" }: { equipo: string; size?: "sm" | "md" }) {
  const code = FLAG_CODES[equipo];
  return (
    <span className="inline-flex items-center gap-2">
      {code ? <img src={`https://flagcdn.com/w40/${code}.png`} alt={equipo} className={size === "sm" ? "h-4 w-6 rounded object-cover border border-white/10" : "h-5 w-7 rounded object-cover border border-zinc-600"} /> : <div className={size === "sm" ? "h-4 w-6 bg-zinc-700 rounded" : "h-5 w-7 bg-zinc-700 rounded"} />}
      <span>{equipo}</span>
    </span>
  );
}

function medallaRanking(index: number) {
  if (index === 0) return "01";
  if (index === 1) return "02";
  if (index === 2) return "03";
  return `${String(index + 1).padStart(2, "0")}`;
}

function cuentaRegresiva(fecha: string | null, ahora: number) {
  if (!fecha) return "Próximamente";
  const target = new Date(fecha).getTime();
  if (isNaN(target)) return "—";
  const diff = target - ahora;
  if (diff <= 0) return "En curso";
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutos = Math.floor((diff / (1000 * 60)) % 60);
  if (dias > 0) return `${dias}d ${horas}h ${minutos}m`;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${minutos}m`;
}

function esEliminatoria(phase: string) { return !phase.startsWith("Grupo"); }

export default function Home() {
  const [usuario, setUsuario] = useState("");
  const [nombreVisible, setNombreVisible] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionInput>>({});
  const [scores, setScores] = useState<Score[]>([]);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
  const [campeon, setCampeon] = useState("");
  const [campeonGuardado, setCampeonGuardado] = useState("");
  const [championStats, setChampionStats] = useState<ChampionStat[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [ahora, setAhora] = useState(Date.now());
  const [tabActiva, setTabActiva] = useState<"grupos" | "eliminatorias" | "ranking" | "reglas" | "miperfil">("eliminatorias");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  useEffect(() => {
    cargarPartidos(); cargarRanking(); cargarCampeonesElegidos(); cargarStandings();
    const savedPlayerId = localStorage.getItem("playerId");
    const savedUsuario = localStorage.getItem("usuario");
    const savedNombreVisible = localStorage.getItem("nombreVisible");
    if (savedPlayerId) { setPlayerId(savedPlayerId); cargarPronosticos(savedPlayerId); cargarCampeon(savedPlayerId); showToast("✅ Sesión recuperada."); }
    if (savedUsuario) setUsuario(savedUsuario);
    if (savedNombreVisible) setNombreVisible(savedNombreVisible);
  }, []);

  useEffect(() => { const interval = setInterval(() => setAhora(Date.now()), 60000); return () => clearInterval(interval); }, []);
  useEffect(() => { if (menuAbierto) { document.body.style.overflow = "hidden"; } else { document.body.style.overflow = ""; } return () => { document.body.style.overflow = ""; }; }, [menuAbierto]);

  const matchesGrupos = useMemo(() => matches.filter(m => !esEliminatoria(m.phase)), [matches]);
  const matchesEliminatorias = useMemo(() => matches.filter(m => esEliminatoria(m.phase)), [matches]);

  const partidosPorGrupo = useMemo(() => {
    const grupos: Record<string, Match[]> = {};
    matchesGrupos.forEach((m) => { if (!grupos[m.phase]) grupos[m.phase] = []; grupos[m.phase].push(m); });
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [matchesGrupos]);

  const proximoPartido = useMemo(() => {
    return matches.filter((m) => m.match_date).filter((m) => { const f = new Date(m.match_date as string).getTime(); return !isNaN(f) && f > ahora; })
      .sort((a, b) => new Date(a.match_date as string).getTime() - new Date(b.match_date as string).getTime())[0] ?? null;
  }, [matches, ahora]);

  const partidosBloqueados = useMemo(() => matches.filter(partidoBloqueado).length, [matches, ahora]);
  const pronosticosCargados = useMemo(() => Object.values(predictions).filter((p) => p.home !== "" && p.away !== "").length, [predictions]);

  function toggleGrupo(g: string) { setGruposAbiertos((prev) => ({ ...prev, [g]: !(prev[g] ?? false) })); }
  function normalizarUsuario(v: string) { return String(v || "").toLowerCase().trim().replace(/\s+/g, ""); }

  function formatearFecha(fecha: string | null) {
    if (!fecha) return "Fecha pendiente";
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "Fecha inválida";
    const dia = date.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" });
    const hora = date.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });
    return `${dia} · ${hora} hs`;
  }

  function partidoBloqueado(match: Match) {
    if (match.force_unlocked) return false;
    if (match.locked) return true;
    if (!match.match_date) return false;
    const f = new Date(match.match_date);
    if (isNaN(f.getTime())) return false;
    return f.getTime() <= Date.now();
  }

  function navegarA(tab: typeof tabActiva) {
    setTabActiva(tab); setMenuAbierto(false);
    setTimeout(() => { document.getElementById("contenido-principal")?.scrollIntoView({ behavior: "smooth" }); }, 100);
  }

  async function cargarPartidos() {
    const { data, error } = await supabase.from("matches").select("id, phase, match_date, home_team, away_team, locked, real_home_goals, real_away_goals, odd_home, odd_draw, odd_away, force_unlocked").order("match_date", { ascending: true });
    if (error) { showToast("Error al cargar partidos.", "error"); return; }
    setMatches(data ?? []);
  }

  async function cargarRanking() {
    const { data, error } = await supabase.from("score").select("id, points, players ( full_name, casino_user )").order("points", { ascending: false });
    if (error) return;
    setScores((data || []).map((item: any) => ({ id: item.id, points: item.points, players: Array.isArray(item.players) ? item.players[0] : item.players })));
  }

  async function cargarCampeonesElegidos() {
    const { data, error } = await supabase.from("champion_predictions").select("champion");
    if (error) return;
    const conteo: Record<string, number> = {};
    (data || []).forEach((row) => { if (row.champion) conteo[row.champion] = (conteo[row.champion] || 0) + 1; });
    setChampionStats(Object.entries(conteo).map(([champion, count]) => ({ champion, count })).sort((a, b) => b.count - a.count).slice(0, 5));
  }

  async function cargarStandings() {
    const { data } = await supabase.from("standings").select("*").order("group_name").order("points", { ascending: false });
    setStandings(data || []);
  }

  async function cargarPronosticos(id: string) {
    const { data, error } = await supabase.from("predictions").select("match_id, predicted_home_goals, predicted_away_goals").eq("player_id", id);
    if (error) return;
    const loaded: Record<string, PredictionInput> = {};
    (data || []).forEach((p) => { loaded[p.match_id] = { home: String(p.predicted_home_goals), away: String(p.predicted_away_goals) }; });
    setPredictions(loaded);
  }

  async function cargarCampeon(id: string) {
    const { data, error } = await supabase.from("champion_predictions").select("champion").eq("player_id", id).maybeSingle();
    if (error) return;
    if (data?.champion) { setCampeon(data.champion); setCampeonGuardado(data.champion); }
  }

  async function guardarCampeon() {
    if (!playerId) { showToast("Primero ingresá con tu usuario BET30.", "error"); return; }
    if (!campeon) { showToast("Elegí un campeón antes de guardar.", "error"); return; }
    const { error } = await supabase.from("champion_predictions").upsert({ player_id: playerId, champion: campeon, updated_at: new Date().toISOString() }, { onConflict: "player_id" });
    if (error) { showToast("Error al guardar campeón.", "error"); return; }
    setCampeonGuardado(campeon); await cargarCampeonesElegidos();
    showToast(`🏆 Campeón guardado: ${campeon}. Si acierta suma +15 pts.`);
  }

  async function registrarse() {
    if (!usuario) { showToast("Ingresá tu usuario BET30.", "error"); return; }
    const usuarioLimpio = normalizarUsuario(usuario);
    const nombreRanking = nombreVisible.trim();
    if (!nombreRanking) { showToast("Ingresá un nombre o apodo para el ranking.", "error"); return; }
    const { data: allowedUsers, error: authError } = await supabase.from("allowed_players").select("casino_user");
    if (authError) { showToast("Error al validar acceso.", "error"); return; }
    if (!(allowedUsers || []).some((u) => normalizarUsuario(u.casino_user) === usuarioLimpio)) { showToast("No estás habilitado para participar. Contactá con soporte.", "error"); return; }
    const { data: players, error: searchError } = await supabase.from("players").select("id, full_name, casino_user");
    if (searchError) { showToast("Error al buscar usuario.", "error"); return; }
    const existing = (players || []).find((p) => normalizarUsuario(p.casino_user) === usuarioLimpio);
    if (existing) {
      await supabase.from("players").update({ full_name: nombreRanking }).eq("id", existing.id);
      setPlayerId(existing.id);
      localStorage.setItem("playerId", existing.id); localStorage.setItem("usuario", existing.casino_user); localStorage.setItem("nombreVisible", nombreRanking);
      setUsuario(existing.casino_user); setNombreVisible(nombreRanking);
      await cargarRanking(); await cargarPronosticos(existing.id); await cargarCampeon(existing.id);
      showToast("✅ Bienvenido nuevamente. Pronósticos cargados."); return;
    }
    const { data, error } = await supabase.from("players").insert({ full_name: nombreRanking, casino_user: usuarioLimpio, paid: true }).select("id").single();
    if (error) { showToast("Error al registrar.", "error"); return; }
    setPlayerId(data.id);
    localStorage.setItem("playerId", data.id); localStorage.setItem("usuario", usuarioLimpio); localStorage.setItem("nombreVisible", nombreRanking);
    setUsuario(usuarioLimpio); setNombreVisible(nombreRanking);
    await cargarRanking(); setCampeon(""); setCampeonGuardado("");
    showToast("✅ Registro exitoso. Ya podés cargar tus pronósticos.");
  }

  async function guardarPronostico(matchId: string) {
    if (!playerId) { showToast("Primero ingresá con tu usuario BET30.", "error"); return; }
    const match = matches.find((m) => m.id === matchId);
    if (!match || partidoBloqueado(match)) { showToast("🔒 Este partido ya está cerrado.", "error"); return; }
    const pred = predictions[matchId];
    if (!pred || pred.home === "" || pred.away === "") { showToast("Completá los goles del partido.", "error"); return; }
    if (Number(pred.home) < 0 || Number(pred.away) < 0) { showToast("Los goles no pueden ser negativos.", "error"); return; }
    const { error } = await supabase.from("predictions").upsert({ player_id: playerId, match_id: matchId, predicted_home_goals: Number(pred.home), predicted_away_goals: Number(pred.away) }, { onConflict: "player_id,match_id" });
    if (error) { showToast("Error al guardar pronóstico.", "error"); return; }
    showToast("✅ Pronóstico guardado.");
  }

  async function guardarTodosLosPronosticos() {
    if (!playerId) { showToast("Primero ingresá con tu usuario BET30.", "error"); return; }
    const toSave = matches.filter((m) => !partidoBloqueado(m)).filter((m) => { const p = predictions[m.id]; return p && p.home !== "" && p.away !== "" && Number(p.home) >= 0 && Number(p.away) >= 0; })
      .map((m) => ({ player_id: playerId, match_id: m.id, predicted_home_goals: Number(predictions[m.id].home), predicted_away_goals: Number(predictions[m.id].away) }));
    if (toSave.length === 0) { showToast("No hay pronósticos completos para guardar.", "error"); return; }
    const { error } = await supabase.from("predictions").upsert(toSave, { onConflict: "player_id,match_id" });
    if (error) { showToast("Error al guardar todos los pronósticos.", "error"); return; }
    showToast(`✅ ${toSave.length} pronósticos guardados correctamente.`);
  }

  function cerrarSesion() {
    localStorage.removeItem("playerId"); localStorage.removeItem("usuario"); localStorage.removeItem("nombreVisible");
    setPlayerId(null); setUsuario(""); setNombreVisible(""); setPredictions({}); setCampeon(""); setCampeonGuardado("");
    showToast("Sesión cerrada.");
  }

  const navItems = [
    { key: "eliminatorias", label: "Eliminatorias",    desc: "Dieciseisavos de final" },
    { key: "grupos",        label: "Fase de grupos",   desc: "Pronosticá los 72 partidos" },
    { key: "ranking",       label: "Ranking",          desc: "Tabla de posiciones" },
    { key: "reglas",        label: "Reglas",           desc: "Cómo funciona el prode" },
    { key: "miperfil",      label: "Mi perfil",        desc: "Tu cuenta y campeón" },
  ] as const;

  function MatchCard({ match }: { match: Match }) {
    const bloqueado = partidoBloqueado(match);
    const hasOdds = match.odd_home || match.odd_draw || match.odd_away;
    const minOdd = Math.min(match.odd_home ?? 999, match.odd_draw ?? 999, match.odd_away ?? 999);
    const elim = esEliminatoria(match.phase);

    return (
      <div style={{
        borderRadius: 10, overflow: "hidden",
        border: `1px solid ${bloqueado ? "#161620" : elim ? "#1e2a3a" : "#1e1e2a"}`,
        background: bloqueado ? "rgba(8,8,12,0.5)" : elim ? "rgba(10,14,22,0.95)" : "rgba(14,14,22,0.95)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 14px", background: "rgba(0,0,0,0.25)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {elim && <span style={{ fontSize: 9, fontWeight: 800, color: "#4f8cff", letterSpacing: "0.15em", textTransform: "uppercase" }}>⚡ ELIMINATORIA</span>}
            {!elim && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444" }}>{match.phase}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {elim && <span style={{ fontSize: 9, color: "#4f8cff", fontWeight: 600 }}>10pts exacto · 6pts ganador+dif · 3pts ganador</span>}
            {match.real_home_goals !== null && match.real_away_goals !== null && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 4, padding: "1px 8px" }}>
                {match.real_home_goals} — {match.real_away_goals}
              </span>
            )}
            {bloqueado && <span style={{ fontSize: 10, fontWeight: 700, color: "#e8357a", letterSpacing: "0.1em", textTransform: "uppercase" }}>Cerrado</span>}
          </div>
        </div>

        <div className="match-card-grid">
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            {FLAG_CODES[match.home_team] && <img src={`https://flagcdn.com/w40/${FLAG_CODES[match.home_team]}.png`} alt={match.home_team} style={{ width: 32, height: 23, borderRadius: 3, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: 9, color: "#ff7722", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 3 }}>Local</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#ddd" }}>{match.home_team}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 8px", gap: 5, borderLeft: "1px solid rgba(255,255,255,0.04)", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input disabled={bloqueado} type="number" min="0" placeholder="—" value={predictions[match.id]?.home ?? ""}
                onChange={(e) => setPredictions((prev) => ({ ...prev, [match.id]: { home: e.target.value, away: prev[match.id]?.away ?? "" } }))}
                style={{ width: 48, height: 44, borderRadius: 6, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, background: bloqueado ? "#0a0a10" : "#111118", border: `1px solid ${bloqueado ? "#1a1a24" : "#2a2a38"}`, color: bloqueado ? "#2a2a38" : "#fff", outline: "none" }} />
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#2a2a38" }}>—</span>
              <input disabled={bloqueado} type="number" min="0" placeholder="—" value={predictions[match.id]?.away ?? ""}
                onChange={(e) => setPredictions((prev) => ({ ...prev, [match.id]: { home: prev[match.id]?.home ?? "", away: e.target.value } }))}
                style={{ width: 48, height: 44, borderRadius: 6, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, background: bloqueado ? "#0a0a10" : "#111118", border: `1px solid ${bloqueado ? "#1a1a24" : "#2a2a38"}`, color: bloqueado ? "#2a2a38" : "#fff", outline: "none" }} />
            </div>
            <div style={{ fontSize: 10, color: "#3a3a48", fontWeight: 600, textAlign: "center" }}>{formatearFecha(match.match_date)}</div>
            {!bloqueado && (
              <button onClick={() => guardarPronostico(match.id)} style={{ padding: "5px 14px", borderRadius: 5, background: elim ? "linear-gradient(135deg,#2255ee,#4f8cff)" : "linear-gradient(135deg,#ff7722,#ffcc00)", color: "#fff", fontSize: 10, fontWeight: 900, border: "none", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Guardar
              </button>
            )}
          </div>

          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexDirection: "row-reverse" }}>
            {FLAG_CODES[match.away_team] && <img src={`https://flagcdn.com/w40/${FLAG_CODES[match.away_team]}.png`} alt={match.away_team} style={{ width: 32, height: 23, borderRadius: 3, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#4f8cff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 3 }}>Visitante</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#ddd" }}>{match.away_team}</div>
            </div>
          </div>
        </div>

        {hasOdds && (
          <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            {[{ label: "1 Local", val: match.odd_home }, { label: "X Empate", val: match.odd_draw }, { label: "2 Visitante", val: match.odd_away }].map(({ label, val }, i) => {
              const isFav = val !== null && val === minOdd;
              return (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px", gap: 3, borderRight: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none", background: isFav ? "rgba(255,119,34,0.07)" : "transparent" }}>
                  <span style={{ fontSize: 10, color: "#444", fontWeight: 600, letterSpacing: "0.05em" }}>{label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: isFav ? "#ff7722" : "#555" }}>{val?.toFixed(2) ?? "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#06060a] text-white" style={{ fontFamily: "'Barlow', sans-serif", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <svg width="100%" height="100%" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.05 }}>
          <ellipse cx="600" cy="350" rx="520" ry="280" fill="none" stroke="white" strokeWidth="1.5"/>
          <ellipse cx="600" cy="350" rx="80" ry="80" fill="none" stroke="white" strokeWidth="1"/>
          <line x1="600" y1="70" x2="600" y2="630" stroke="white" strokeWidth="1"/>
          <rect x="80" y="220" width="140" height="260" fill="none" stroke="white" strokeWidth="1"/>
          <rect x="980" y="220" width="140" height="260" fill="none" stroke="white" strokeWidth="1"/>
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(34,85,238,0.06) 0%, transparent 55%), radial-gradient(ellipse at 20% 70%, rgba(232,53,122,0.04) 0%, transparent 40%)" }} />
      </div>

      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14, backdropFilter: "blur(12px)", border: `1px solid ${t.type === "success" ? "rgba(74,222,128,0.4)" : "rgba(232,53,122,0.4)"}`, background: t.type === "success" ? "rgba(4,20,10,0.95)" : "rgba(20,4,10,0.95)", color: t.type === "success" ? "#4ade80" : "#f87171", animation: "slideIn 0.3s ease" }}>
            {t.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        .match-card-grid { display: grid; grid-template-columns: 1fr 160px 1fr; align-items: center; }
        @media (max-width: 640px) {
          .match-card-grid { grid-template-columns: 1fr; }
          .match-card-grid > div:last-child { flex-direction: row !important; justify-content: flex-start !important; text-align: left !important; border-top: 1px solid rgba(255,255,255,0.04); }
        }
      `}</style>

      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(6,6,10,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-screen-xl mx-auto px-4 md:px-6" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={BET30_LOGO} alt="BET30" style={{ height: 28, width: "auto", objectFit: "contain" }} />
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#ffcc00" }}>Mundial 2026</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ key, label }) => (
              <button key={key} onClick={() => navegarA(key)} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: tabActiva === key ? "rgba(255,119,34,0.15)" : "transparent", color: tabActiva === key ? "#ff7722" : "#666", borderBottom: tabActiva === key ? "2px solid #ff7722" : "2px solid transparent" }}>{label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {playerId && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{nombreVisible || "Jugador"}</span>
              </div>
            )}
            <button onClick={() => setMenuAbierto(!menuAbierto)} className="md:hidden" style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <span style={{ width: 18, height: 2, background: menuAbierto ? "#ff7722" : "#fff", borderRadius: 2, transition: "all 0.2s", transform: menuAbierto ? "rotate(45deg) translate(5px,5px)" : "none" }} />
              <span style={{ width: 18, height: 2, background: menuAbierto ? "transparent" : "#fff", borderRadius: 2, transition: "all 0.2s" }} />
              <span style={{ width: 18, height: 2, background: menuAbierto ? "#ff7722" : "#fff", borderRadius: 2, transition: "all 0.2s", transform: menuAbierto ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
            </button>
          </div>
        </div>
        {menuAbierto && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(8,8,14,0.98)", borderBottom: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", padding: "12px 16px 20px", zIndex: 99 }}>
            {navItems.map(({ key, label, desc }) => (
              <button key={key} onClick={() => navegarA(key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, marginBottom: 6, background: tabActiva === key ? "rgba(255,119,34,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${tabActiva === key ? "rgba(255,119,34,0.35)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "left" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: tabActiva === key ? "#ff7722" : "#ccc" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{desc}</div>
                </div>
                {tabActiva === key && <span style={{ color: "#ff7722" }}>●</span>}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Hero */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div className="relative overflow-hidden bg-[#06060a]">
          <div className="absolute top-0 left-0 right-0 h-[3px] z-30" style={{ background: "linear-gradient(90deg, #e8357a, #ff9500, #ffcc00, #2255ee)" }} />
          <div className="absolute inset-0 z-0">
            <img src="/og-image.png" alt="" className="w-full h-full object-cover object-center" style={{ opacity: 0.08 }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #06060a, rgba(6,6,10,0.85), rgba(6,6,10,0.3))" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(6,6,10,0.7), transparent, #06060a)" }} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] z-20" style={{ background: "linear-gradient(90deg, transparent, #16a34a, #22c55e, #16a34a, transparent)" }} />
          <div className="relative z-10 w-full max-w-screen-xl mx-auto px-4 md:px-6">
            <div className="grid md:grid-cols-[1fr_400px] min-h-[480px] w-full items-stretch">
              <div className="flex flex-col justify-between py-10 pr-0 md:pr-8">
                <div>
                  <div className="flex items-center gap-3 mb-6 flex-wrap">
                    <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, background: "rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}><span style={{ color: "#e8357a" }}>BET</span><span style={{ color: "#2255ee" }}>30</span></span>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", border: "1px solid rgba(232,53,122,0.4)", borderRadius: 4, background: "rgba(232,53,122,0.08)" }}>
                      <span className="w-2 h-2 rounded-full bg-[#e8357a] animate-pulse" />
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "#e8357a" }}>Ranking en vivo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{ width: 28, height: 2, background: "#ffcc00" }} />
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.4em", textTransform: "uppercase", color: "#ffcc00" }}>Mundial 2026</span>
                  </div>
                  <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", lineHeight: 0.88, marginBottom: 20 }}>
                    <span style={{ display: "block", fontSize: "clamp(72px, 10vw, 104px)", color: "#ffffff" }}>PRODE</span>
                    <span style={{ display: "block", fontSize: "clamp(72px, 10vw, 104px)", color: "transparent", WebkitTextStroke: "2.5px #e8357a" } as React.CSSProperties}>MUNDIAL</span>
                    <span style={{ display: "block", fontSize: "clamp(72px, 10vw, 104px)", color: "#2255ee" }}>BET30</span>
                  </h1>
                  <p style={{ color: "#888", fontSize: 15, maxWidth: 400, lineHeight: 1.6, marginBottom: 8 }}>Pronosticá cada partido, elegí el campeón y peleá por el podio.</p>
                  <p style={{ color: "#bbb", fontSize: 14, marginBottom: 32 }}>Participá con carga mínima de <span style={{ color: "#ff7722", fontWeight: 800 }}>$25.000</span></p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { label: "Partidos", value: String(TOTAL_PARTIDOS), color: "#ff7722" },
                    { label: "Cerrados", value: String(partidosBloqueados), color: "#4f8cff" },
                    { label: "Pronósticos", value: String(pronosticosCargados), color: "#ffcc00" },
                    { label: "Líder", value: `${scores[0]?.points ?? 0}`, color: "#e8357a", unit: "pts" },
                  ].map(({ label, value, color, unit }, i) => (
                    <div key={label} style={{ padding: "14px 10px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#444", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 1, color }}>{value}{unit && <span style={{ fontSize: 14, marginLeft: 3 }}>{unit}</span>}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative hidden md:flex flex-col justify-between overflow-hidden" style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(255,196,0,0.12) 0%, transparent 65%)" }} />
                <img src={WORLD_CUP_2030_LOGO} alt="Copa" className="absolute inset-0 w-full h-full object-cover object-center" style={{ opacity: 0.95, mixBlendMode: "luminosity" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #06060a 0%, transparent 35%)" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, #06060a 0%, #06060a 18%, transparent 42%, transparent 72%, #06060a 100%)" }} />
                <div className="relative z-10 mt-auto mx-5 mb-5" style={{ background: "rgba(4,4,10,0.88)", border: "1px solid rgba(255,255,255,0.07)", borderTop: "2px solid #ffcc00", borderRadius: "0 0 10px 10px", padding: "16px 18px", backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "#ffcc00", marginBottom: 12 }}>Premios</div>
                  {[["🥇","1° Puesto","$700.000"],["🥈","2° Puesto","$200.000"],["🥉","3° Puesto","$100.000"]].map(([m,pos,amt]) => (
                    <div key={pos} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 13, marginRight: 8 }}>{m}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "#bbb" }}>{pos}</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#ffcc00" }}>{amt}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {[["8 pts","Exacto grupos"],["10 pts","Exacto elimin."],["3 pts","Ganador"],["6 pts","Ganador+dif elim."],["+15 pts","Campeón correcto"]].map(([pts,desc]) => (
                      <div key={desc} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#ff7722", whiteSpace: "nowrap" }}>{pts}</span>
                        <span style={{ fontSize: 11, color: "#555", lineHeight: 1.3 }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="contenido-principal" style={{ position: "relative", zIndex: 1 }} className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* Tab bar desktop */}
        <div className="hidden md:block" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", background: "#0a0a10" }}>
          <div className="grid grid-cols-5">
            {navItems.map(({ key, label }) => {
              const colors: Record<string,string> = { grupos:"#e8357a", eliminatorias:"#4f8cff", ranking:"#ffcc00", reglas:"#22c55e", miperfil:"#a78bfa" };
              const ac = colors[key];
              return <button key={key} onClick={() => setTabActiva(key)} style={{ padding: "13px 8px", fontWeight: 800, fontSize: 13, borderTop: "none", borderLeft: "none", borderRight: "none", borderBottom: `3px solid ${tabActiva === key ? ac : "transparent"}`, color: tabActiva === key ? ac : "#555", background: tabActiva === key ? `${ac}15` : "transparent", cursor: "pointer" } as React.CSSProperties}>{label}</button>;
            })}
          </div>
        </div>

        {/* Tab bar mobile */}
        <div className="md:hidden" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", background: "#0a0a10" }}>
          <div className="grid grid-cols-3">
            {navItems.slice(0,3).map(({ key, label }) => {
              const colors: Record<string,string> = { grupos:"#e8357a", eliminatorias:"#4f8cff", ranking:"#ffcc00" };
              const ac = colors[key] ?? "#ff7722";
              return <button key={key} onClick={() => setTabActiva(key)} style={{ padding: "12px 6px", fontWeight: 800, fontSize: 12, borderTop: "none", borderLeft: "none", borderRight: "none", borderBottom: `3px solid ${tabActiva === key ? ac : "transparent"}`, color: tabActiva === key ? ac : "#555", background: tabActiva === key ? `${ac}15` : "transparent", cursor: "pointer" } as React.CSSProperties}>{label}</button>;
            })}
          </div>
        </div>

        {/* Próximo partido */}
        {(tabActiva === "grupos" || tabActiva === "eliminatorias") && proximoPartido && (
          <div style={{ borderRadius: 14, border: "1px solid rgba(255,119,34,0.3)", background: "linear-gradient(135deg,#0f0f16,#0d0d14)", padding: "20px 24px" }}>
            <div className="grid md:grid-cols-[1fr_200px] gap-4 items-center">
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "#ff7722", marginBottom: 12 }}>Próximo partido</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}><BanderaEquipo equipo={proximoPartido.home_team} /></div>
                  <div style={{ width: "fit-content", background: "#ff7722", color: "#000", fontSize: 10, fontWeight: 900, padding: "3px 10px", borderRadius: 4 }}>VS</div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}><BanderaEquipo equipo={proximoPartido.away_team} /></div>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: "#ffcc00", fontWeight: 700 }}>🕒 {formatearFecha(proximoPartido.match_date)}</div>
              </div>
              <div style={{ background: "rgba(255,204,0,0.05)", border: "1px solid rgba(255,204,0,0.2)", borderRadius: 12, padding: "18px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>Cuenta regresiva</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: "#ffcc00", lineHeight: 1 }}>{cuentaRegresiva(proximoPartido.match_date, ahora)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Ingresar / Mi perfil */}
        {(tabActiva === "grupos" || tabActiva === "miperfil") && (
          <div style={{ borderRadius: 14, border: "1px solid rgba(124,58,237,0.4)", background: "#0d0d14", padding: "22px 24px" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.05em", marginBottom: 6 }}>{tabActiva === "miperfil" ? "Mi perfil" : "Ingresar al Prode"}</h2>
            {!playerId ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Ingresá tu usuario BET30 para validar el acceso y un nombre para el ranking.</p>
                <input style={{ width:"100%", padding:"12px 14px", borderRadius:8, background:"#111118", border:"1px solid #222230", color:"#fff", fontSize:14, outline:"none" }} placeholder="Usuario BET30" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
                <input style={{ width:"100%", padding:"12px 14px", borderRadius:8, background:"#111118", border:"1px solid #222230", color:"#fff", fontSize:14, outline:"none" }} placeholder="Nombre o apodo para el ranking" value={nombreVisible} onChange={(e) => setNombreVisible(e.target.value)} />
                <button onClick={registrarse} style={{ width:"100%", padding:"13px", borderRadius:8, background:"linear-gradient(90deg,#ff7722,#ffcc00)", color:"#000", fontWeight:900, fontSize:15, border:"none", cursor:"pointer" }}>Ingresar</button>
              </div>
            ) : (
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:16, padding:16, borderRadius:10, background:"rgba(74,222,128,0.05)", border:"1px solid rgba(74,222,128,0.2)", marginBottom:16 }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(74,222,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>👤</div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:"#4ade80" }}>{nombreVisible || "Jugador"}</div>
                    <div style={{ fontSize:12, color:"#444" }}>Usuario BET30 · sesión activa</div>
                  </div>
                  {campeonGuardado && <div style={{ marginLeft:"auto", textAlign:"right" }}><div style={{ fontSize:10, color:"#666", marginBottom:4 }}>Campeón elegido</div><div style={{ fontSize:13, fontWeight:700 }}><BanderaEquipo equipo={campeonGuardado} size="sm" /></div></div>}
                </div>
                <button onClick={cerrarSesion} style={{ padding:"10px 24px", borderRadius:8, background:"rgba(232,53,122,0.1)", color:"#e8357a", fontWeight:800, border:"1px solid rgba(232,53,122,0.3)", cursor:"pointer", fontSize:14 }}>Cerrar sesión</button>
              </div>
            )}
          </div>
        )}

        {/* Campeón */}
        {(tabActiva === "grupos" || tabActiva === "miperfil") && (
          <div className="grid lg:grid-cols-[1fr_300px] gap-4">
            <div style={{ borderRadius:14, border:"1px solid rgba(255,204,0,0.2)", background:"#0d0d14", padding:"22px 24px" }}>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.35em", textTransform:"uppercase", color:"#ffcc00", marginBottom:8 }}>Bonus especial</div>
              <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:26, letterSpacing:"0.03em", marginBottom:8 }}>Elegí al campeón del Mundial</h2>
              <p style={{ fontSize:13, color:"#666", marginBottom:16 }}>Si acertás el campeón sumás <span style={{ color:"#ffcc00", fontWeight:800 }}>+15 puntos</span> al ranking.</p>
              <div className="grid md:grid-cols-[1fr_200px] gap-3">
                <select value={campeon} onChange={(e) => setCampeon(e.target.value)} style={{ width:"100%", padding:"12px 14px", borderRadius:8, background:"#111118", border:"1px solid #222230", color:"#fff", fontSize:14, outline:"none" }}>
                  <option value="">Seleccionar campeón</option>
                  {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={guardarCampeon} disabled={!playerId} style={{ padding:"12px 16px", borderRadius:8, fontWeight:900, fontSize:14, border:"none", cursor: playerId ? "pointer" : "not-allowed", background: playerId ? "#ffcc00" : "#1a1a22", color: playerId ? "#000" : "#444" }}>
                  {playerId ? "Guardar campeón" : "Iniciá sesión primero"}
                </button>
              </div>
              {campeonGuardado && <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderRadius:8, background:"rgba(74,222,128,0.06)", border:"1px solid rgba(74,222,128,0.2)" }}><span style={{ fontSize:13, color:"#4ade80", fontWeight:700 }}>✅ Campeón guardado:</span><BanderaEquipo equipo={campeonGuardado} size="sm" /></div>}
            </div>
            <div style={{ borderRadius:14, border:"1px solid rgba(255,204,0,0.18)", background:"#0d0d14", padding:"22px 20px" }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#ffcc00", marginBottom:14 }}>🔥 Más elegidos</div>
              {championStats.length === 0 ? <p style={{ fontSize:13, color:"#444" }}>Todavía no hay campeones elegidos.</p> : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {championStats.map((stat, i) => (
                    <div key={stat.champion} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", borderRadius:8, background:"#111118", border:"1px solid #1e1e28" }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>#{i+1} <BanderaEquipo equipo={stat.champion} size="sm" /></div>
                      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:20, color:"#ffcc00" }}>{stat.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB GRUPOS */}
        {tabActiva === "grupos" && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div style={{ borderRadius:14, border:"1px solid rgba(124,58,237,0.35)", background:"#0d0d14", padding:"20px 22px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:"#ff7722" }}>Top Prode</h2>
                  <button onClick={() => setTabActiva("ranking")} style={{ fontSize:12, fontWeight:800, padding:"6px 14px", borderRadius:6, background:"#2255ee", color:"#fff", border:"none", cursor:"pointer" }}>Ver completo</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {scores.length === 0 && <p style={{ fontSize:13, color:"#444" }}>Todavía no hay puntos cargados.</p>}
                  {scores.slice(0,3).map((score, i) => (
                    <div key={score.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:10, border:"1px solid", borderColor: i===0?"rgba(255,204,0,0.4)":i===1?"rgba(200,200,200,0.2)":"rgba(249,115,22,0.3)", background: i===0?"rgba(255,204,0,0.05)":i===1?"rgba(255,255,255,0.02)":"rgba(249,115,22,0.04)" }}>
                      <span style={{ fontWeight:800, fontSize:15, display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:i===0?"#ffcc00":i===1?"#aaa":"#cd7c3a", minWidth:28 }}>{medallaRanking(i)}</span>
                        {score.players?.full_name ?? "Sin nombre"}
                      </span>
                      <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:"#ffcc00" }}>{score.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius:14, border:"1px solid rgba(232,53,122,0.35)", background:"#0d0d14", padding:"20px 22px" }}>
                <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:"#e8357a", marginBottom:16 }}>Premios</h2>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[["1° Puesto","$700.000"],["2° Puesto","$200.000"],["3° Puesto","$100.000"]].map(([pos,amt]) => (
                    <div key={pos} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:15 }}>
                      <span style={{ color:"#bbb" }}>{pos}</span>
                      <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:20, color:"#ffcc00" }}>{amt}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:18, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.06)", fontSize:13 }}>
                  <div style={{ fontWeight:800, color:"#ff7722", marginBottom:8 }}>Sistema de puntos · Fase de grupos</div>
                  {["Resultado exacto: 8 pts","Ganador correcto: 3 pts","Diferencia exacta: +2 pts","Campeón correcto: +15 pts"].map((l) => <div key={l} style={{ color:"#555", marginBottom:3 }}>{l}</div>)}
                </div>
              </div>
            </div>

            <div style={{ borderRadius:14, border:"1px solid #1a1a24", background:"rgba(10,10,16,0.85)", padding:"20px 22px", backdropFilter:"blur(8px)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
                <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:24 }}>Fixture y pronósticos</h2>
                <button onClick={guardarTodosLosPronosticos} style={{ padding:"11px 22px", borderRadius:8, background:"linear-gradient(90deg,#e8357a,#2255ee)", color:"#fff", fontWeight:900, fontSize:14, border:"none", cursor:"pointer" }}>Guardar todos</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {partidosPorGrupo.map(([grupo, partidos]) => {
                  const abierto = gruposAbiertos[grupo] ?? false;
                  return (
                    <div key={grupo} style={{ borderRadius:12, overflow:"hidden", border:"1px solid #1a1a24" }}>
                      <button onClick={() => toggleGrupo(grupo)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", cursor:"pointer", border:"none", background: abierto ? "linear-gradient(90deg, rgba(255,119,34,0.08), rgba(255,119,34,0.02), transparent)" : "rgba(255,255,255,0.015)", borderLeft: abierto ? "3px solid #ff7722" : "3px solid rgba(255,255,255,0.06)" }}>
                        <div>
                          <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:17, color: abierto ? "#ff7722" : "#555" }}>{abierto ? "▼" : "▶"} {grupo}</div>
                          <div style={{ fontSize:11, color:"#444", marginTop:2, fontWeight:600 }}>{partidos.length} partidos</div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:800, color:"#ffcc00", letterSpacing:"0.1em", textTransform:"uppercase" }}>{abierto ? "Ocultar" : "Ver partidos"}</span>
                      </button>
                      {abierto && (
                        <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:6, background:"rgba(0,0,0,0.2)" }}>
                          {partidos.map((match) => <MatchCard key={match.id} match={match} />)}
                          {(() => {
                            const tabla = standings.filter(s => s.group_name === grupo).sort((a,b) => b.points - a.points || (b.goals_for-b.goals_against)-(a.goals_for-a.goals_against));
                            if (tabla.length === 0) return null;
                            return (
                              <div style={{ marginTop:8, borderRadius:10, overflow:"hidden", border:"1px solid rgba(34,197,94,0.2)" }}>
                                <div style={{ padding:"10px 16px", background:"linear-gradient(90deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02), transparent)", borderLeft:"3px solid #22c55e", display:"flex", alignItems:"center", gap:8 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                                  <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.2em", textTransform:"uppercase", color:"#22c55e" }}>Tabla de posiciones</span>
                                </div>
                                <div style={{ background:"rgba(0,0,0,0.3)", overflowX:"auto" }}>
                                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                                    <thead>
                                      <tr style={{ borderBottom:"1px solid #1a1a24" }}>
                                        <th style={{ textAlign:"left", padding:"8px 14px", color:"#555", fontWeight:700, fontSize:10 }}>Equipo</th>
                                        {["PJ","G","E","P","GF","GC","DG"].map(h => <th key={h} style={{ textAlign:"center", padding:"8px 8px", color:"#555", fontWeight:700, fontSize:10 }}>{h}</th>)}
                                        <th style={{ textAlign:"center", padding:"8px 10px", color:"#ffcc00", fontWeight:800, fontSize:10 }}>Pts</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tabla.map((s, i) => (
                                        <tr key={s.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background: i===0?"rgba(34,197,94,0.07)":i===1?"rgba(34,197,94,0.03)":"transparent" }}>
                                          <td style={{ padding:"9px 14px" }}>
                                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                              <span style={{ fontSize:11, color:i<2?"#22c55e":"#444", fontWeight:800, minWidth:16 }}>{i+1}</span>
                                              {FLAG_CODES[s.team] && <img src={`https://flagcdn.com/w40/${FLAG_CODES[s.team]}.png`} alt={s.team} style={{ width:22, height:16, borderRadius:2, objectFit:"cover" }} />}
                                              <span style={{ fontWeight:700, color:"#ccc", whiteSpace:"nowrap" }}>{s.team}</span>
                                            </div>
                                          </td>
                                          {[s.played,s.won,s.drawn,s.lost,s.goals_for,s.goals_against,s.goals_for-s.goals_against].map((v,vi) => <td key={vi} style={{ textAlign:"center", padding:"9px 8px", color:"#777" }}>{v}</td>)}
                                          <td style={{ textAlign:"center", padding:"9px 10px", fontFamily:"'Bebas Neue', sans-serif", fontSize:16, color:"#ffcc00" }}>{s.points}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* TAB ELIMINATORIAS */}
        {tabActiva === "eliminatorias" && (
          <div style={{ borderRadius:14, border:"1px solid rgba(34,85,238,0.35)", background:"#0d0d14", padding:"24px" }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.4em", textTransform:"uppercase", color:"#4f8cff", marginBottom:6 }}>⚡ Eliminatorias</div>
            <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:30, marginBottom:4 }}>Dieciseisavos de Final</h2>
            <div style={{ display:"flex", gap:16, marginBottom:20, fontSize:12, color:"#555", flexWrap:"wrap" }}>
              <span><span style={{ color:"#4f8cff", fontWeight:800 }}>10 pts</span> resultado exacto</span>
              <span><span style={{ color:"#4f8cff", fontWeight:800 }}>6 pts</span> ganador + dif. exacta</span>
              <span><span style={{ color:"#4f8cff", fontWeight:800 }}>3 pts</span> solo ganador</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
              <span style={{ fontSize:13, color:"#555" }}>{matchesEliminatorias.length} partidos</span>
              <button onClick={guardarTodosLosPronosticos} style={{ padding:"10px 20px", borderRadius:8, background:"linear-gradient(90deg,#2255ee,#4f8cff)", color:"#fff", fontWeight:900, fontSize:13, border:"none", cursor:"pointer" }}>Guardar todos</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {matchesEliminatorias.map((match) => <MatchCard key={match.id} match={match} />)}
            </div>
          </div>
        )}

        {/* TAB RANKING */}
        {tabActiva === "ranking" && (
          <div style={{ borderRadius:14, border:"1px solid rgba(255,204,0,0.35)", background:"#0d0d14", padding:"24px" }}>
            <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:30, color:"#ffcc00", marginBottom:20 }}>Ranking completo</h2>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {scores.length === 0 && <p style={{ fontSize:13, color:"#444" }}>Todavía no hay puntos cargados.</p>}
              {scores.map((score, i) => (
                <div key={score.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderRadius:10, border:"1px solid", borderColor: i===0?"rgba(255,204,0,0.4)":i===1?"rgba(200,200,200,0.2)":i===2?"rgba(249,115,22,0.3)":"#1a1a24", background: i===0?"rgba(255,204,0,0.05)":i===1?"rgba(255,255,255,0.02)":i===2?"rgba(249,115,22,0.04)":"#111118" }}>
                  <span style={{ fontWeight:800, fontSize:15, display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:i===0?"#ffcc00":i===1?"#aaa":i===2?"#cd7c3a":"#333", minWidth:28 }}>{medallaRanking(i)}</span>
                    {score.players?.full_name ?? "Sin nombre"}
                  </span>
                  <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:"#ffcc00" }}>{score.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB REGLAS */}
        {tabActiva === "reglas" && (
          <div style={{ borderRadius:14, border:"1px solid rgba(34,197,94,0.3)", background:"#0d0d14", padding:"28px" }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.4em", textTransform:"uppercase", color:"#22c55e", marginBottom:10 }}>Información</div>
            <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:30, marginBottom:24 }}>Reglas del Prode</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { titulo:"¿Cómo participar?", texto:"Ingresá con tu usuario BET30 con una carga mínima de $25.000. Una vez validado, podés empezar a cargar tus pronósticos.", color:"#ff7722" },
                { titulo:"Puntos · Fase de grupos", texto:"Resultado exacto: 8 pts. Ganador correcto: 3 pts. Diferencia de goles exacta: +2 pts adicionales. Campeón correcto: +15 pts bonus.", color:"#ffcc00" },
                { titulo:"Puntos · Eliminatorias ⚡", texto:"Resultado exacto: 10 pts. Ganador correcto: 3 pts. Diferencia de goles exacta: +3 pts adicionales (total 6 pts sin exacto). Campeón correcto: +15 pts bonus.", color:"#4f8cff" },
                { titulo:"Cierre de pronósticos", texto:"Cada partido se cierra automáticamente al inicio del mismo. No se pueden modificar los pronósticos una vez cerrado el partido.", color:"#e8357a" },
                { titulo:"Premios", texto:"1° Puesto: $700.000 · 2° Puesto: $200.000 · 3° Puesto: $100.000. Los premios se acreditan al finalizar el torneo.", color:"#22c55e" },
                { titulo:"Desempate", texto:"En caso de empate en puntos, se desempata por mayor cantidad de resultados exactos, luego por ganador/empate correctos.", color:"#a78bfa" },
              ].map(({ titulo, texto, color }) => (
                <div key={titulo} style={{ padding:"20px 22px", borderRadius:12, background:"linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", border:"1px solid #1e1e2a", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, width:3, height:"100%", background:color }} />
                  <div style={{ fontWeight:800, fontSize:15, marginBottom:8, color:"#e0e0e0", marginLeft:4 }}>{titulo}</div>
                  <div style={{ fontSize:13, color:"#666", lineHeight:1.7, marginLeft:4 }}>{texto}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tabActiva === "miperfil" && (
          <div style={{ borderRadius:14, border:"1px solid rgba(124,58,237,0.35)", background:"#0d0d14", padding:"24px" }}>
            <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:26, marginBottom:16 }}>Mi perfil</h2>
            {!playerId ? <p style={{ color:"#555" }}>Iniciá sesión para ver tu perfil.</p> : (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ padding:16, borderRadius:10, background:"rgba(74,222,128,0.05)", border:"1px solid rgba(74,222,128,0.2)" }}>
                  <div style={{ fontSize:16, fontWeight:800, color:"#4ade80" }}>{nombreVisible}</div>
                  <div style={{ fontSize:12, color:"#444", marginTop:4 }}>Pronósticos cargados: {pronosticosCargados}</div>
                </div>
                <button onClick={cerrarSesion} style={{ width:"fit-content", padding:"10px 24px", borderRadius:8, background:"rgba(232,53,122,0.1)", color:"#e8357a", fontWeight:800, border:"1px solid rgba(232,53,122,0.3)", cursor:"pointer" }}>Cerrar sesión</button>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
