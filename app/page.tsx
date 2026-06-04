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

type ChampionStat = {
  champion: string;
  count: number;
};


const WORLD_CUP_TROPHY_IMAGE = "/trophy-hero.png";
const WORLD_CUP_2030_LOGO = "/worldcup2030-logo.png";
const BET30_LOGO = "/bet30-logo.png";
const TOTAL_PARTIDOS_GRUPOS = 72;

const FLAG_CODES: Record<string, string> = {
  México: "mx",
  Sudáfrica: "za",
  "Corea del Sur": "kr",
  "República Checa": "cz",
  Canadá: "ca",
  Bosnia: "ba",
  "Estados Unidos": "us",
  Paraguay: "py",
  Qatar: "qa",
  Suiza: "ch",
  Brasil: "br",
  Marruecos: "ma",
  Haití: "ht",
  Escocia: "gb",
  Australia: "au",
  Turquía: "tr",
  Alemania: "de",
  Curazao: "cw",
  "Países Bajos": "nl",
  Japón: "jp",
  "Costa de Marfil": "ci",
  Ecuador: "ec",
  Suecia: "se",
  Túnez: "tn",
  España: "es",
  "Cabo Verde": "cv",
  Bélgica: "be",
  Egipto: "eg",
  "Arabia Saudita": "sa",
  Uruguay: "uy",
  Irán: "ir",
  "Nueva Zelanda": "nz",
  Francia: "fr",
  Senegal: "sn",
  Irak: "iq",
  Noruega: "no",
  Argentina: "ar",
  Argelia: "dz",
  Austria: "at",
  Jordania: "jo",
  Portugal: "pt",
  "RD Congo": "cd",
  Inglaterra: "gb",
  Croacia: "hr",
  Ghana: "gh",
  Panamá: "pa",
  Uzbekistán: "uz",
  Colombia: "co",
};

const TEAMS = Object.keys(FLAG_CODES).sort((a, b) => a.localeCompare(b));

function BanderaEquipo({ equipo }: { equipo: string }) {
  const code = FLAG_CODES[equipo];

  return (
    <span className="inline-flex items-center gap-2">
      {code ? (
        <img
          src={`https://flagcdn.com/w40/${code}.png`}
          alt={equipo}
          className="h-5 w-7 rounded object-cover border border-zinc-600"
        />
      ) : (
        <div className="h-5 w-7 bg-zinc-700 rounded" />
      )}
      <span>{equipo}</span>
    </span>
  );
}

function medallaRanking(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

function estiloRanking(index: number) {
  if (index === 0) {
    return "border-yellow-400/80 shadow-[0_0_24px_rgba(255,204,0,0.20)] bg-gradient-to-r from-yellow-500/10 to-[#1b1b25]";
  }

  if (index === 1) {
    return "border-zinc-300/60 shadow-[0_0_20px_rgba(255,255,255,0.10)] bg-gradient-to-r from-white/10 to-[#1b1b25]";
  }

  if (index === 2) {
    return "border-orange-500/70 shadow-[0_0_20px_rgba(249,115,22,0.15)] bg-gradient-to-r from-orange-500/10 to-[#1b1b25]";
  }

  return "border-zinc-700 bg-[#1b1b25]";
}

function cuentaRegresiva(fecha: string | null, ahora: number) {
  if (!fecha) return "Fecha pendiente";

  const target = new Date(fecha).getTime();

  if (isNaN(target)) return "Fecha inválida";

  const diff = target - ahora;

  if (diff <= 0) return "Ya empezó";

  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutos = Math.floor((diff / (1000 * 60)) % 60);

  if (dias > 0) return `${dias}d ${horas}h ${minutos}m`;
  if (horas > 0) return `${horas}h ${minutos}m`;

  return `${minutos}m`;
}

export default function Home() {
  const [usuario, setUsuario] = useState("");
  const [nombreVisible, setNombreVisible] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionInput>>({});
  const [scores, setScores] = useState<Score[]>([]);
  const [rankingAbierto, setRankingAbierto] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
  const [campeon, setCampeon] = useState("");
  const [campeonGuardado, setCampeonGuardado] = useState("");
  const [championStats, setChampionStats] = useState<ChampionStat[]>([]);
  const [ahora, setAhora] = useState(Date.now());
  const [tabActiva, setTabActiva] = useState<"grupos" | "eliminatorias" | "ranking">("grupos");

  useEffect(() => {
    cargarPartidos();
    cargarRanking();
    cargarCampeonesElegidos();

    const savedPlayerId = localStorage.getItem("playerId");
    const savedUsuario = localStorage.getItem("usuario");
    const savedNombreVisible = localStorage.getItem("nombreVisible");

    if (savedPlayerId) {
      setPlayerId(savedPlayerId);
      cargarPronosticos(savedPlayerId);
      cargarCampeon(savedPlayerId);
      setMensaje("✅ Sesión recuperada.");
    }

    if (savedUsuario) setUsuario(savedUsuario);
    if (savedNombreVisible) setNombreVisible(savedNombreVisible);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAhora(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const partidosPorGrupo = useMemo(() => {
    const grupos: Record<string, Match[]> = {};

    matches.forEach((match) => {
      if (!grupos[match.phase]) grupos[match.phase] = [];
      grupos[match.phase].push(match);
    });

    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  const proximoPartido = useMemo(() => {
    return (
      matches
        .filter((match) => match.match_date)
        .filter((match) => {
          const fecha = new Date(match.match_date as string).getTime();
          return !isNaN(fecha) && fecha > ahora;
        })
        .sort((a, b) => {
          const fechaA = new Date(a.match_date as string).getTime();
          const fechaB = new Date(b.match_date as string).getTime();
          return fechaA - fechaB;
        })[0] ?? null
    );
  }, [matches, ahora]);

  const partidosBloqueados = useMemo(() => {
    return matches.filter((match) => partidoBloqueado(match)).length;
  }, [matches, ahora]);

  const pronosticosCargados = useMemo(() => {
    return Object.values(predictions).filter((pred) => pred.home !== "" && pred.away !== "").length;
  }, [predictions]);

  function toggleGrupo(grupo: string) {
    setGruposAbiertos((prev) => ({
      ...prev,
      [grupo]: !(prev[grupo] ?? false),
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

  async function cargarCampeonesElegidos() {
    const { data, error } = await supabase
      .from("champion_predictions")
      .select("champion");

    if (error) {
      console.log("Error cargando campeones elegidos:", error);
      return;
    }

    const conteo: Record<string, number> = {};

    (data || []).forEach((row) => {
      if (!row.champion) return;
      conteo[row.champion] = (conteo[row.champion] || 0) + 1;
    });

    const stats = Object.entries(conteo)
      .map(([champion, count]) => ({ champion, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setChampionStats(stats);
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

  async function cargarCampeon(idJugador: string) {
    const { data, error } = await supabase
      .from("champion_predictions")
      .select("champion")
      .eq("player_id", idJugador)
      .maybeSingle();

    if (error) {
      console.log("Error cargando campeón:", error);
      return;
    }

    if (data?.champion) {
      setCampeon(data.champion);
      setCampeonGuardado(data.champion);
    }
  }

  async function guardarCampeon() {
    if (!playerId) {
      setMensaje("Primero ingresá con tu usuario BET30.");
      return;
    }

    if (!campeon) {
      setMensaje("Elegí un campeón antes de guardar.");
      return;
    }

    const { error } = await supabase.from("champion_predictions").upsert(
      {
        player_id: playerId,
        champion: campeon,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "player_id",
      }
    );

    if (error) {
      console.log("Error guardando campeón:", error);
      setMensaje("Error al guardar campeón.");
      return;
    }

    setCampeonGuardado(campeon);
    await cargarCampeonesElegidos();
    setMensaje(`🏆 Campeón guardado: ${campeon}. Si acierta suma +15 pts.`);
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

    const nombreRanking = nombreVisible.trim();

    if (!nombreRanking) {
      setMensaje("Ingresá un nombre o apodo para mostrar en el ranking.");
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
      const { error: updateError } = await supabase
        .from("players")
        .update({ full_name: nombreRanking })
        .eq("id", existingPlayer.id);

      if (updateError) {
        console.log("Error actualizando apodo:", updateError);
        setMensaje("Error al actualizar tu apodo.");
        return;
      }

      setPlayerId(existingPlayer.id);

      localStorage.setItem("playerId", existingPlayer.id);
      localStorage.setItem("usuario", existingPlayer.casino_user);
      localStorage.setItem("nombreVisible", nombreRanking);

      setUsuario(existingPlayer.casino_user);
      setNombreVisible(nombreRanking);

      await cargarRanking();
      await cargarPronosticos(existingPlayer.id);
      await cargarCampeon(existingPlayer.id);

      setMensaje("✅ Bienvenido nuevamente. Tus pronósticos anteriores fueron cargados.");
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        full_name: nombreRanking,
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
    localStorage.setItem("nombreVisible", nombreRanking);

    setUsuario(usuarioLimpio);
    setNombreVisible(nombreRanking);
    await cargarRanking();
    setCampeon("");
    setCampeonGuardado("");

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
    localStorage.removeItem("nombreVisible");
    setPlayerId(null);
    setUsuario("");
    setNombreVisible("");
    setPredictions({});
    setCampeon("");
    setCampeonGuardado("");
    setMensaje("Sesión cerrada.");
  }

  return (
    <main className="min-h-screen bg-[#08080c] text-white p-4 md:p-6">
      <section className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#7c3aed]/70 bg-[#050508] p-5 md:p-8 mb-6 shadow-[0_0_45px_rgba(124,58,237,0.24)]">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(232,53,122,0.24),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(255,204,0,0.13),transparent_30%),radial-gradient(circle_at_85%_85%,rgba(34,85,238,0.24),transparent_36%)]" />
  <div className="absolute inset-0 opacity-[0.10] bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#2255ee] to-transparent" />

  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <img
      src={WORLD_CUP_2030_LOGO}
      alt="Emblema Mundial"
      className="w-[92%] max-w-[920px] opacity-[0.07] object-contain blur-[0.3px] scale-110"
    />
  </div>

  <div className="absolute -left-24 top-20 h-56 w-56 rounded-full bg-[#e8357a]/20 blur-3xl" />
  <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-[#2255ee]/20 blur-3xl" />

  <div className="relative z-10 grid gap-8 md:grid-cols-[1.05fr_430px] items-center">
    <div>
      <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-[#e8357a]/40 bg-black/35 px-4 py-2 backdrop-blur-md shadow-[0_0_20px_rgba(232,53,122,0.18)]">
        <span className="text-[10px] md:text-xs tracking-[0.35em] uppercase text-orange-300">
          Prime Rock x
        </span>

        <img
          src={BET30_LOGO}
          alt="BET30"
          className="h-8 md:h-9 w-auto object-contain drop-shadow-[0_0_14px_rgba(34,85,238,0.45)]"
        />
      </div>

      <h1 className="text-5xl md:text-7xl font-black leading-[0.92] mb-4 tracking-tight">
        Prode
        <br />
        Mundial
        <br />
        <span className="text-[#e8357a] drop-shadow-[0_0_20px_rgba(232,53,122,0.35)]">
          BET
        </span>
        <span className="text-[#2255ee] drop-shadow-[0_0_20px_rgba(34,85,238,0.45)]">
          30
        </span>
      </h1>

      <p className="text-gray-300 text-base md:text-lg max-w-xl">
        Viví el Mundial con pronósticos, ranking en vivo, premios y bonus por campeón elegido.
      </p>

      <p className="mt-3 text-gray-300">
        Participá con una carga mínima de{" "}
        <span className="text-orange-400 font-black">$25.000</span>
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs text-gray-400">Partidos</p>
          <p className="text-2xl font-black text-orange-400">
            {TOTAL_PARTIDOS_GRUPOS}
          </p>
        </div>

        <div className="rounded-xl border border-[#2255ee]/40 bg-[#2255ee]/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs text-gray-400">Cerrados</p>
          <p className="text-2xl font-black text-[#7aa2ff]">
            {partidosBloqueados}
          </p>
        </div>

        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs text-gray-400">Tus pronósticos</p>
          <p className="text-2xl font-black text-yellow-400">
            {pronosticosCargados}
          </p>
        </div>

        <div className="rounded-xl border border-[#e8357a]/40 bg-[#e8357a]/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs text-gray-400">Líder</p>
          <p className="text-2xl font-black text-[#e8357a]">
            {scores[0]?.points ?? 0} pts
          </p>
        </div>
      </div>
    </div>

    <div className="relative flex justify-center md:justify-end">
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle,rgba(255,196,0,0.24),transparent_58%)] blur-2xl" />

      <div className="relative w-full max-w-[410px] rounded-[2rem] border border-white/10 bg-white/[0.055] p-3 backdrop-blur-md shadow-[0_0_38px_rgba(255,196,0,0.14)]">
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/40">
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/5 to-black/20" />

          <img
            src={WORLD_CUP_TROPHY_IMAGE}
            alt="Copa del Mundo BET30"
            className="h-[360px] md:h-[430px] w-full object-cover"
          />

          <div className="absolute left-4 top-4 z-20 rounded-full border border-yellow-500/30 bg-black/45 px-3 py-2 backdrop-blur-md">
            <p className="text-[10px] tracking-[0.28em] uppercase text-yellow-300">
              Edición premium
            </p>
          </div>

          <div className="absolute left-4 bottom-4 right-4 z-20">
            <div className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md shadow-[0_0_25px_rgba(0,0,0,0.35)]">
              <p className="text-[11px] tracking-[0.3em] uppercase text-orange-300">
                Prode oficial
              </p>

              <p className="mt-1 text-2xl font-black text-white">
                Camino al campeón
              </p>

              <p className="text-sm text-gray-300">
                Pronosticá, competí y peleá por el top del ranking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div className="mb-6 overflow-hidden rounded-2xl border border-[#7c3aed]/70 bg-[#0b0b12] shadow-[0_0_30px_rgba(124,58,237,0.18)]">
  <div className="grid grid-cols-3">
    <button
      onClick={() => setTabActiva("grupos")}
      className={`p-4 font-black text-sm md:text-lg transition ${
        tabActiva === "grupos"
          ? "bg-[#e8357a]/15 text-[#e8357a] border-b-4 border-[#e8357a]"
          : "text-gray-300 hover:bg-white/5"
      }`}
    >
      ⚽ Fase de grupos
    </button>

    <button
      onClick={() => setTabActiva("eliminatorias")}
      className={`p-4 font-black text-sm md:text-lg transition ${
        tabActiva === "eliminatorias"
          ? "bg-[#2255ee]/15 text-[#4f8cff] border-b-4 border-[#2255ee]"
          : "text-gray-300 hover:bg-white/5"
      }`}
    >
      🏆 Eliminatorias
    </button>

    <button
      onClick={() => setTabActiva("ranking")}
      className={`p-4 font-black text-sm md:text-lg transition ${
        tabActiva === "ranking"
          ? "bg-yellow-500/15 text-yellow-400 border-b-4 border-yellow-400"
          : "text-gray-300 hover:bg-white/5"
      }`}
    >
      📊 Ranking
    </button>
  </div>
</div>

{tabActiva === "grupos" && proximoPartido && (
  <div className="mb-6 rounded-2xl border border-orange-500/60 bg-gradient-to-r from-[#1b1b25] to-[#10101a] p-5 shadow-[0_0_26px_rgba(249,115,22,0.16)]">
    <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-center">
      <div>
        <p className="text-xs tracking-[0.35em] uppercase text-orange-400 mb-2">
          Próximo partido
        </p>

        <div className="flex flex-col gap-2 text-xl md:text-2xl font-black">
          <BanderaEquipo equipo={proximoPartido.home_team} />
          <span className="w-fit rounded bg-orange-500 px-2 py-1 text-xs font-black text-black">
            VS
          </span>
          <BanderaEquipo equipo={proximoPartido.away_team} />
        </div>

        <p className="mt-3 text-yellow-400 font-bold">
          🕒 {formatearFecha(proximoPartido.match_date)}
        </p>
      </div>

      <div className="rounded-2xl border border-yellow-500/50 bg-yellow-500/10 p-4 text-center">
        <p className="text-sm text-gray-300">Cuenta regresiva</p>
        <p className="text-3xl font-black text-yellow-400">
          {cuentaRegresiva(proximoPartido.match_date, ahora)}
        </p>
      </div>
    </div>
  </div>
)}

<div className="mb-6 rounded-2xl border border-orange-500/40 bg-gradient-to-r from-[#1b1b25] to-[#10101a] p-5 md:p-6 shadow-[0_0_25px_rgba(249,115,22,0.15)]">
  <h2 className="text-2xl font-black text-orange-400 mb-2">
    🎁 ¿Querés participar?
  </h2>

  <p className="text-gray-300 mb-5">
    Si todavía no tenés cuenta, hablá con uno de nuestros cajeros y empezá a competir en el Prode Mundial BET30.
  </p>

  <div className="grid md:grid-cols-3 gap-3">
    <a
      href="https://wa.link/3bu64g"
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl bg-green-600 hover:bg-green-500 p-4 text-center font-black transition"
    >
      🟢 Línea Verde
    </a>

    <a
      href="https://wa.link/krk6kw"
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl bg-purple-600 hover:bg-purple-500 p-4 text-center font-black transition"
    >
      🟣 Línea Violeta
    </a>

    <a
      href="https://wa.link/g578ir"
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl bg-red-600 hover:bg-red-500 p-4 text-center font-black transition"
    >
      🔴 Línea Roja
    </a>
  </div>
</div>

<div className="bg-[#111118] border border-[#7c3aed] p-5 md:p-6 rounded-2xl mb-6 shadow-[0_0_30px_rgba(124,58,237,0.25)]">
  <h2 className="text-xl font-black mb-2">Ingresar al Prode</h2>

  {!playerId ? (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Ingresá tu usuario BET30 para validar el acceso y un nombre o apodo para aparecer en el ranking.
      </p>

      <input
        className="w-full p-3 rounded bg-[#1b1b25] border border-zinc-700 text-white outline-none focus:ring-2 focus:ring-orange-400"
        placeholder="Usuario BET30"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
      />

      <input
        className="w-full p-3 rounded bg-[#1b1b25] border border-zinc-700 text-white outline-none focus:ring-2 focus:ring-orange-400"
        placeholder="Nombre o apodo para el ranking"
        value={nombreVisible}
        onChange={(e) => setNombreVisible(e.target.value)}
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
        ✅ Conectado como {nombreVisible || "Jugador"}
      </p>

      <p className="text-xs text-gray-500 mt-1">
        Usuario BET30 guardado de forma privada.
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
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <p className="text-xs tracking-[0.35em] uppercase text-yellow-400 mb-2">
                Bonus especial
              </p>

              <h2 className="text-2xl md:text-3xl font-black mb-2">
                Elegí al campeón del Mundial
              </h2>

              <p className="text-sm text-gray-300 mb-4">
                Si acertás el campeón sumás{" "}
                <span className="text-yellow-400 font-black">+15 puntos</span> al ranking.
              </p>

              <div className="grid md:grid-cols-[1fr_220px] gap-3 items-center">
                <select
                  value={campeon}
                  onChange={(e) => setCampeon(e.target.value)}
                  className="w-full p-3 rounded bg-[#0f0f16] border border-zinc-600 text-white outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Seleccionar campeón</option>
                  {TEAMS.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>

                <button
                  onClick={guardarCampeon}
                  disabled={!playerId}
                  className={`font-black p-3 rounded transition ${
                    playerId
                      ? "bg-yellow-500 text-black hover:bg-orange-400"
                      : "bg-gray-600 text-gray-300 cursor-not-allowed"
                  }`}
                >
                  {playerId ? "Guardar campeón" : "Iniciá sesión para guardar"}
                </button>
              </div>

              {campeonGuardado && (
                <p className="mt-4 text-green-400 font-bold">
                  Campeón elegido: <BanderaEquipo equipo={campeonGuardado} />
                </p>
              )}

              {!playerId && (
                <p className="mt-4 text-orange-300 font-bold">
                  Primero ingresá con tu usuario BET30 para guardar tu campeón.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-yellow-500/30 bg-black/20 p-4">
              <p className="font-black text-yellow-400 mb-3">Más elegidos</p>

              {championStats.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Todavía no hay campeones elegidos.
                </p>
              ) : (
                <div className="space-y-3">
                  {championStats.map((stat, index) => (
                    <div
                      key={stat.champion}
                      className="flex items-center justify-between rounded-xl border border-zinc-700 bg-[#111118] p-3"
                    >
                      <div className="font-bold">
                        #{index + 1} <BanderaEquipo equipo={stat.champion} />
                      </div>
                      <p className="text-yellow-400 font-black">{stat.count}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        {tabActiva === "grupos" && (
          <>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-[#111118] border border-[#7c3aed] p-5 md:p-6 rounded-2xl shadow-[0_0_25px_rgba(34,85,238,0.15)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-orange-400">Top Prode</h2>

                  <button
                    onClick={() => setTabActiva("ranking")}
                    className="text-sm bg-[#2255ee] px-3 py-2 rounded font-bold hover:bg-[#e8357a] transition"
                  >
                    Ver ranking completo
                  </button>
                </div>

                <div className="space-y-3">
                  {scores.length === 0 && (
                    <p className="text-gray-400">Todavía no hay puntos cargados.</p>
                  )}

                  {scores.slice(0, 3).map((score, index) => (
                    <div
                      key={score.id}
                      className={`border p-4 rounded-xl flex justify-between ${estiloRanking(index)}`}
                    >
                      <div>
                        <p className="font-black text-lg">
                          {medallaRanking(index)} {score.players?.full_name ?? "Sin nombre"}
                        </p>
                      </div>

                      <p className="text-[#ffcc00] font-black text-xl">
                        {score.points} pts
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111118] border border-[#e8357a] p-5 md:p-6 rounded-2xl shadow-[0_0_25px_rgba(232,53,122,0.18)]">
                <h2 className="text-xl font-black mb-4 text-[#e8357a]">Premios</h2>

                <div className="space-y-3 text-base md:text-lg">
                  <p>
                    🥇 1° Puesto: <span className="font-bold text-[#ffcc00]">$700.000</span>
                  </p>
                  <p>
                    🥈 2° Puesto: <span className="font-bold text-[#ffcc00]">$200.000</span>
                  </p>
                  <p>
                    🥉 3° Puesto: <span className="font-bold text-[#ffcc00]">$100.000</span>
                  </p>
                </div>

                <div className="mt-6 border-t border-white/10 pt-4 text-sm">
                  <h3 className="font-bold mb-2 text-orange-400">Sistema de puntos</h3>
                  <p>Resultado exacto: 8 pts</p>
                  <p>Ganador/empate correcto: 3 pts</p>
                  <p>Diferencia de gol correcta: +2 pts</p>
                  <p>Campeón correcto: +15 pts</p>
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

              <div className="space-y-5">
                {partidosPorGrupo.map(([grupo, partidos]) => {
                  const abierto = gruposAbiertos[grupo] ?? false;

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

                                  <div className="space-y-2">
                                    <div className="font-black text-white">
                                      <BanderaEquipo equipo={match.home_team} />
                                    </div>

                                    <div className="w-fit rounded bg-orange-500 px-2 py-1 text-xs font-black text-black">
                                      VS
                                    </div>

                                    <div className="font-black text-white">
                                      <BanderaEquipo equipo={match.away_team} />
                                    </div>
                                  </div>

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
          </>
        )}

        {tabActiva === "eliminatorias" && (
          <div className="bg-[#111118] border border-[#2255ee]/70 p-5 md:p-6 rounded-2xl shadow-[0_0_30px_rgba(34,85,238,0.18)]">
            <p className="text-xs tracking-[0.4em] uppercase text-[#4f8cff] mb-3">
              Eliminatorias
            </p>

            <h2 className="text-3xl font-black mb-3">🏆 Cruces eliminatorios</h2>

            <p className="text-gray-300 mb-5">
              Acá van a aparecer los cruces de eliminación directa cuando termine la fase de grupos.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                "Dieciseisavos",
                "Octavos",
                "Cuartos",
                "Semifinales",
                "Tercer puesto",
                "Final",
              ].map((fase) => (
                <div
                  key={fase}
                  className="rounded-2xl border border-zinc-700 bg-[#0f0f16] p-5"
                >
                  <p className="text-xl font-black text-white">{fase}</p>
                  <p className="mt-2 text-sm text-gray-400">
                    Próximamente disponible.
                  </p>
                  <button className="mt-4 w-full rounded border border-[#2255ee] bg-[#2255ee]/10 p-3 font-black text-[#4f8cff]">
                    🔒 Bloqueado
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tabActiva === "ranking" && (
          <div className="bg-[#111118] border border-yellow-500/70 p-5 md:p-6 rounded-2xl shadow-[0_0_30px_rgba(255,204,0,0.14)]">
            <h2 className="text-3xl font-black text-yellow-400 mb-5">
              📊 Ranking completo
            </h2>

            <div className="space-y-3">
              {scores.map((score, index) => (
                <div
                  key={score.id}
                  className={`border p-4 rounded-xl flex justify-between ${estiloRanking(index)}`}
                >
                  <div>
                    <p className="font-black">
                      {medallaRanking(index)} {score.players?.full_name ?? "Sin nombre"}
                    </p>
                  </div>

                  <p className="text-[#ffcc00] font-black">{score.points} pts</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {rankingAbierto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111118] border border-[#7c3aed] rounded-2xl p-5 md:p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-[0_0_40px_rgba(124,58,237,0.35)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-orange-400">
                Ranking completo
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
                  className={`border p-4 rounded-xl flex justify-between ${estiloRanking(index)}`}
                >
                  <div>
                    <p className="font-bold">
                      {medallaRanking(index)} {score.players?.full_name ?? "Sin nombre"}
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
