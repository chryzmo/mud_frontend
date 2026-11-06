import { FC, ReactElement } from 'react';

interface Props {
  onCommand: (line: string) => void;
}

const ACTIONS: [string, string][] = [
  ['Look', 'LOOK'],
  ['Items', 'INVENTORY'],
  ['Stats', 'STATS'],
  ['Help', 'HELP'],
];

// The commands a player reaches for most, one tap each.
const QuickActions: FC<Props> = ({ onCommand }): ReactElement => (
  <div className="quick">
    {ACTIONS.map(([label, line]) => (
      <button key={line} type="button" className="quick-btn" onClick={() => onCommand(line)}>{label}</button>
    ))}
  </div>
);

export default QuickActions;
