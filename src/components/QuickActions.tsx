import { FC, ReactElement } from 'react';

interface Props {
  onCommand: (line: string) => void;
  // Opens the list of what is in the room. Shown only when there is something to tap.
  onHere?: () => void;
  // Opens JOURNAL, HINT and MAP.
  onGuide?: () => void;
  // Opens global chat: say something to everyone, or hide the channel.
  onChat?: () => void;
  // Opens the Style sheet (earned name colours and badges). Shown only when the player owns one.
  onStyle?: () => void;
  // Opens the Spells sheet (what you know and what is on the bar). Shown only once you know a spell.
  onSpells?: () => void;
}

const ACTIONS: [string, string][] = [
  ['Look', 'LOOK'],
  ['Items', 'INVENTORY'],
  ['Stats', 'STATS'],
  ['Help', 'HELP'],
];

// The commands a player reaches for most, one tap each.
const QuickActions: FC<Props> = ({ onCommand, onHere, onGuide, onChat, onStyle, onSpells }): ReactElement => (
  <div className="quick">
    {onHere && <button type="button" className="quick-btn" onClick={onHere}>Here</button>}
    {onGuide && <button type="button" className="quick-btn" onClick={onGuide}>Guide</button>}
    {onChat && <button type="button" className="quick-btn" onClick={onChat}>Chat</button>}
    {onSpells && <button type="button" className="quick-btn" onClick={onSpells}>Spells</button>}
    {onStyle && <button type="button" className="quick-btn" onClick={onStyle}>Style</button>}
    {ACTIONS.map(([label, line]) => (
      <button key={line} type="button" className="quick-btn" onClick={() => onCommand(line)}>{label}</button>
    ))}
  </div>
);

export default QuickActions;
