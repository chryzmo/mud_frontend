import { FC, ReactElement } from "react";

export interface Stats {
  hp: number;
  maxhp: number;
  mp: number;
  maxmp: number;
  atk: number;
  atkbonus: number;
  def: number;
  defbonus: number;
}

interface Props {
  stats: Stats | null;
}

const StatsBar: FC<Props> = ({ stats }): ReactElement => {
  if (!stats) return <div id="statsbar" />;

  const statVal = (value: number, bonus: number) =>
    bonus > 0
      ? <span className="stat-boosted">{value}</span>
      : <span>{value}</span>;

  return (
    <div id="statsbar" role="group" aria-label="Your stats">
      <div className="stat-row">
        <span className="stat-label">HP</span>
        <span className="stat-value hp-value">{stats.hp} / {stats.maxhp}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">MP</span>
        <span className="stat-value mp-value">{stats.mp} / {stats.maxmp}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">ATK</span>
        <span className="stat-value">{statVal(stats.atk, stats.atkbonus)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">DEF</span>
        <span className="stat-value">{statVal(stats.def, stats.defbonus)}</span>
      </div>
    </div>
  );
};

export default StatsBar;
