import { FC, ReactElement, useEffect } from 'react';

export interface SheetAction {
  label: string;
  run: () => void;
}

interface Props {
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}

// A bottom sheet of big buttons: what to do with a name the player tapped.
const ActionSheet: FC<Props> = ({ title, actions, onClose }): ReactElement => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">{title}</div>
        {actions.map((a) => (
          <button
            key={a.label} type="button" className="sheet-action"
            onClick={() => {
              onClose();
              a.run();
            }}
          >
            {a.label}
          </button>
        ))}
        <button type="button" className="sheet-action sheet-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default ActionSheet;
