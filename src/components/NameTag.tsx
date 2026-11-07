import { FC, ReactElement } from 'react';
import { badgeGlyph, colorClass } from '../cosmetics';

interface Props {
  name: string;
  color?: string;
  badge?: string;
  className?: string;
  suffix?: string;
}

// A player's name with their cosmetics: the colour class and the badge glyph before the name. Both
// come from fixed lists, so an unknown key from the server draws a plain name.
const NameTag: FC<Props> = ({ name, color, badge, className = '', suffix = '' }): ReactElement => {
  const glyph = badgeGlyph(badge);
  const cls = [className, colorClass(color)].filter(Boolean).join(' ');
  return (
    <span className={cls || undefined}>
      {glyph && <span className="badge" role="img" aria-label={`${badge} badge`}>{glyph} </span>}
      {name}{suffix}
    </span>
  );
};

export default NameTag;
