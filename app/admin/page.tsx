"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Match = {
  id: string;
  phase: string;
  match_date: string;
  home_team: string;
  away_team: string;
  real_home_goals: number | null;
  real_away_goals: number | null;
  locked: boolean | null;
};

type Player = {
  id: string;
  full_name: string | null;
  casino_user: string | null;
};

type Prediction = {
  player_id: string;
  match_id: string;
  predicted_home_goals: number;
  predicted_away_goals: number;
};

type ScoreRow = {
  id: string;
  points: number;
  players: Player | Player[] | null;
};

type RankingRow = {
  id: string;
  points: number;
  player: Player | null;
};

function parseGoalValue(value: string) {
  if (value === "") return null;
  return Number(value);
}

function getOutcome(homeGoals: number, awayGoals: number) {
  if (homeGoals > awayGoals) return "home";
  if (homeGoals < awayGoals) return "away";
  return "draw";
}

function calculatePredictionPoints(
  prediction: Prediction,
  match: Pick<Match, "real_home_goals" | "real_away_goals">
) {
  const realHome = match.real_home_goals;
  const realAway = match.real_away_goals;

  if (realHome === null || realAway === null) return 0;

  const exact =
    prediction.predicted_home_goals === realHome &&
    prediction.predicted_away_goals === realAway;

  if (exact) return 8;

  let points = 0;

  const predictedOutcome = getOutcome(
    prediction.predicted_home_goals,
    prediction.predicted_away_goals
  );
  const realOutcome = getOutcome(realHome, realAway);

  if (predictedOutcome === realOutcome) {
    points += 3;
  }

  const predictedDifference =
    prediction.predicted_home_goals - prediction.predicted_away_goals;
  const realDifference = realHome - realAway;

  if (predictedDifference === realDifference) {
    points += 2;
  }

  return points;
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  const completedMatches = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.real_home_goals !== null && match.real_away_goals !== null
      ).length,
    [matches]
  );

  useEffect(() => {
    async function loadInitialData() {
      await Promise.all([cargarPartidos(), cargarRanking()]);
    }

    loadInitialData();
  }, []);

  async function cargarPartidos() {
    const { data, error } = await supabase
      .from("matches")
      .select(
        "id, phase, match_date, home_team, away_team, real_home_goals, real_away_goals, locked"
      )
      .order("match_date", { ascending: true });

    if (error) {
      console.log(error);
      setMensaje("Error al cargar partidos.");
      return;
    }

    setMatches((data ?? []) as Match[]);
  }

  async function cargarRanking() {
    const { data, error } = await supabase
      .from("score")
      .select(
        `
        id,
        points,
        players (
          id,
          full_name,
          casino_user
        )
      `
      )
      .order("points", { ascending: false });

    if (error) {
      console.log(error);
      setMensaje("Error al cargar ranking.");
      return;
    }

    const formattedRanking = ((data ?? []) as ScoreRow[]).map((row) => ({
      id: row.id,
      points: row.points,
      player: Array.isArray(row.players) ? row.players[0] ?? null : row.players,
    }));

    setRanking(formattedRanking);
  }

  async function guardarResultado(match: Match) {
    if (match.real_home_goals === null || match.real_away_goals === null) {
      setMensaje("Completá los goles reales antes de guardar.");
      return;
    }

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

    if (error) {
      console.log(error);
      setMensaje("Error al guardar resultado.");
      setGuardandoId(null);
      return;
    }

    setMatches((prev) =>
      prev.map((item) =>
        item.id === match.id ? { ...item, locked: true } : item
      )
    );

    const rankingActualizado = await calcularRanking();
    if (rankingActualizado) {
      setMensaje("Resultado guardado, partido bloqueado y ranking actualizado.");
    }
    setGuardandoId(null);
  }

  async function calcularRanking() {
    setCalculando(true);
    setMensaje("");

    const [
      { data: playersData, error: playersError },
      { data: matchesData, error: matchesError },
      { data: predictionsData, error: predictionsError },
      { data: currentScoresData, error: scoresError },
    ] = await Promise.all([
      supabase.from("players").select("id, full_name, casino_user"),
      supabase
        .from("matches")
        .select("id, real_home_goals, real_away_goals")
        .not("real_home_goals", "is", null)
        .not("real_away_goals", "is", null),
      supabase
        .from("predictions")
        .select(
          "player_id, match_id, predicted_home_goals, predicted_away_goals"
        ),
      supabase.from("score").select("id, player_id"),
    ]);

    if (playersError || matchesError || predictionsError || scoresError) {
      console.log(playersError || matchesError || predictionsError || scoresError);
      setMensaje("Error al calcular ranking.");
      setCalculando(false);
      return false;
    }

    const players = (playersData ?? []) as Player[];
    const playedMatches = new Map(
      ((matchesData ?? []) as Pick<
        Match,
        "id" | "real_home_goals" | "real_away_goals"
      >[]).map((match) => [match.id, match])
    );
    const pointsByPlayer = new Map(players.map((player) => [player.id, 0]));

    ((predictionsData ?? []) as Prediction[]).forEach((prediction) => {
      const match = playedMatches.get(prediction.match_id);
      if (!match) return;

      pointsByPlayer.set(
        prediction.player_id,
        (pointsByPlayer.get(prediction.player_id) ?? 0) +
          calculatePredictionPoints(prediction, match)
      );
    });

    const currentScoresByPlayer = new Map(
      ((currentScoresData ?? []) as { id: string; player_id: string }[]).map(
        (score) => [score.player_id, score.id]
      )
    );

    const newScoreRows: { player_id: string; points: number }[] = [];

    for (const [playerId, points] of pointsByPlayer) {
      const scoreId = currentScoresByPlayer.get(playerId);

      if (!scoreId) {
        newScoreRows.push({ player_id: playerId, points });
        continue;
      }

      const { error } = await supabase
        .from("score")
        .update({ points })
        .eq("id", scoreId);

      if (error) {
        console.log(error);
        setMensaje("Error al actualizar la tabla score.");
        setCalculando(false);
        return false;
      }
    }

    if (newScoreRows.length > 0) {
      const { error } = await supabase.from("score").insert(newScoreRows);

      if (error) {
        console.log(error);
        setMensaje("Error al crear puntajes en la tabla score.");
        setCalculando(false);
        return false;
      }
    }

    await cargarRanking();
    setMensaje("Ranking calculado y tabla score actualizada.");
    setCalculando(false);
    return true;
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <section className="mx-auto max-w-6xl">
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

          <button
            onClick={calcularRanking}
            disabled={calculando}
            className="rounded bg-yellow-500 px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-white"
          >
            {calculando ? "Calculando..." : "Calcular ranking"}
          </button>
        </div>

        {mensaje && (
          <p className="mb-4 rounded bg-zinc-900 p-3 font-bold text-green-400">
            {mensaje}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Resultados reales</h2>

            {matches.length === 0 && (
              <p className="rounded bg-zinc-900 p-4 text-gray-400">
                No hay partidos cargados.
              </p>
            )}

            {matches.map((match) => (
              <div
                key={match.id}
                className="grid gap-3 rounded bg-zinc-900 p-4 md:grid-cols-5 md:items-center"
              >
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-400">{match.phase}</p>
                  <p className="font-bold">
                    {match.home_team} vs {match.away_team}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {match.locked ? "Bloqueado" : "Pendiente"}
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
                              real_home_goals: parseGoalValue(
                                event.target.value
                              ),
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
                              real_away_goals: parseGoalValue(
                                event.target.value
                              ),
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
                  {guardandoId === match.id ? "Guardando..." : "Guardar"}
                </button>
              </div>
            ))}
          </section>

          <aside>
            <h2 className="mb-4 text-2xl font-bold">Ranking</h2>

            {ranking.length === 0 && (
              <p className="rounded bg-zinc-900 p-4 text-gray-400">
                Todavía no hay puntos cargados.
              </p>
            )}

            <div className="space-y-3">
              {ranking.map((score, index) => (
                <div
                  key={score.id}
                  className="flex items-center justify-between rounded bg-zinc-900 p-4"
                >
                  <div>
                    <p className="font-bold">
                      #{index + 1}{" "}
                      {score.player?.full_name || score.player?.casino_user}
                    </p>
                    <p className="text-sm text-gray-400">
                      {score.player?.casino_user}
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
