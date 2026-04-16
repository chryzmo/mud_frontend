import { FC, ReactElement } from "react";

interface Props {
  exits: string[];
  onNavigate: (dir: string) => void;
}

// Rendered in a fixed compass-like grid: N on top, S below, E/W on sides, U/D flanking.
const NavButtons: FC<Props> = ({ exits, onNavigate }): ReactElement => {
  if (exits.length === 0) return <></>;

  const btn = (dir: string) => {
    const active = exits.includes(dir);
    return (
      <button
        key={dir}
        className={active ? 'navbutton' : 'navbutton navbutton-inactive'}
        disabled={!active}
        onClick={() => onNavigate(dir)}
      >
        {dir}
      </button>
    );
  };

  return (
    <div id="navdiv">
      <div className="navrow">{btn('U')}{btn('N')}{btn('D')}</div>
      <div className="navrow">{btn('W')}{btn('S')}{btn('E')}</div>
    </div>
  );
};

export default NavButtons;
