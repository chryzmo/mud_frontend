import { FC, ReactElement } from "react";

interface Props {
  exits: string[];
  onNavigate: (dir: string) => void;
}

// A fixed compass pad, so the layout does not jump as exits change: N on top, S
// below, W and E at the sides, U and D in the corners. Only real exits are enabled.
const NavButtons: FC<Props> = ({ exits, onNavigate }): ReactElement => {
  const btn = (dir: string) => {
    const active = exits.includes(dir);
    return (
      <button
        key={dir}
        type="button"
        className={active ? 'navbutton' : 'navbutton navbutton-inactive'}
        disabled={!active}
        onClick={() => onNavigate(dir)}
      >
        {dir}
      </button>
    );
  };

  return (
    <div id="navdiv" role="group" aria-label="Directions">
      {btn('U')}{btn('N')}{btn('D')}
      {btn('W')}{btn('S')}{btn('E')}
    </div>
  );
};

export default NavButtons;
