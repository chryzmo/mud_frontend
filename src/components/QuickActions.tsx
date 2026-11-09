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

// The buttons, in the order players reach for them: what is here, then looking, the pack, spells, stats, chat, and
// the guide; the Style sheet last, since only players who earned a name colour or badge have it. Here, Spells and
// Style show only when there is something behind them. The buttons that open a sheet say so (aria-haspopup); the
// sheet is a modal dialog, so the button is hidden behind it and needs no expanded state.
const QuickActions: FC<Props> = ({ onCommand, onHere, onGuide, onChat, onStyle, onSpells }): ReactElement => {
  const sheet = (label: string, open: () => void) => (
    <button type="button" className="quick-btn" aria-haspopup="dialog" onClick={open}>{label}</button>
  );
  const command = (label: string, line: string) => (
    <button type="button" className="quick-btn" onClick={() => onCommand(line)}>{label}</button>
  );
  return (
    <div className="quick">
      {onHere && sheet('Here', onHere)}
      {command('Look', 'LOOK')}
      {command('Items', 'INVENTORY')}
      {onSpells && sheet('Spells', onSpells)}
      {command('Stats', 'STATS')}
      {onChat && sheet('Chat', onChat)}
      {onGuide && sheet('Guide', onGuide)}
      {onStyle && sheet('Style', onStyle)}
    </div>
  );
};

export default QuickActions;
