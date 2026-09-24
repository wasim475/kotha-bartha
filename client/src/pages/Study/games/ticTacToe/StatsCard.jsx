import Card from "../../../../components/ui/Card";

function Tile({ label, value, kind }) {
  return (
    <div className="game-result-tile" data-kind={kind}>
      <span className="text-[10px] font-bold tracking-wide text-muted uppercase">{label}</span>
      <span className="game-result-tile-value">{value}</span>
    </div>
  );
}

/** Played / Wins / Losses / Draws — calculated by the server from completed games. */
export default function StatsCard({ stats }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted uppercase">Tic-Tac-Toe</h2>
      <div className="grid grid-cols-4 gap-2" aria-label="Your Tic-Tac-Toe statistics">
        <Tile label="Played" value={stats ? stats.played : "–"} />
        <Tile label="Wins" value={stats ? stats.wins : "–"} kind="correct" />
        <Tile label="Losses" value={stats ? stats.losses : "–"} kind="wrong" />
        <Tile label="Draws" value={stats ? stats.draws : "–"} />
      </div>
    </Card>
  );
}
