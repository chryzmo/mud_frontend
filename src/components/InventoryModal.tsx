import { FC, useEffect } from "react";
import { createPortal } from "react-dom";
import * as MUDCONST from "../utils/constants";

interface Props {
    isShown: boolean;
    hide: () => void;
    msgText: string;
    onItem: (name: string) => void;
}

// itemsOf reads the INVENTORY reply: "2x sword" lines in green, after a heading.
export function itemsOf(msgText: string): { line: string; name: string }[] {
    const { ESCAPE_START, GREEN, ESCAPE_END } = MUDCONST.MUDCOLOR;
    return msgText
        .replace('Your inventory contains:', '')
        .split('\n')
        .map((l) => l.replace(ESCAPE_START + GREEN, '').replace(ESCAPE_END, '').trim())
        .filter((l) => l !== '' && l !== 'Your inventory is empty.')
        .map((line) => ({ line, name: line.replace(/^\d+x /, '') }));
}

export const InventoryModal: FC<Props> = ({ isShown, hide, msgText, onItem }) => {
    useEffect(() => {
        if (!isShown) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === "Escape") hide();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isShown, hide]);

    if (!isShown) return null;
    const items = itemsOf(msgText);
    return createPortal(
        <div className="sheet-backdrop" onClick={hide}>
            <div className="sheet" role="dialog" aria-label="Your inventory" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-title">Your inventory</div>
                {items.length === 0 && <div className="sheet-empty">Your inventory is empty.</div>}
                {items.map((it) => (
                    <button key={it.line} type="button" className="sheet-action" onClick={() => onItem(it.name)}>
                        <span className="itemNameSpan">{it.line}</span>
                    </button>
                ))}
                <button type="button" className="sheet-action sheet-cancel" onClick={hide}>Close</button>
            </div>
        </div>,
        document.body,
    );
};
