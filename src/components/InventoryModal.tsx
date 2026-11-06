import { FC, useEffect, useRef } from "react";
import { useDialogFocus } from "../useDialogFocus";
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

const Sheet: FC<Omit<Props, 'isShown'>> = ({ hide, msgText, onItem }) => {
    const sheet = useRef<HTMLDivElement>(null);
    useDialogFocus(sheet);
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") hide();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [hide]);

    const items = itemsOf(msgText);
    return createPortal(
        <div className="sheet-backdrop" onClick={hide}>
            <div className="sheet" ref={sheet} role="dialog" aria-modal="true" aria-label="Your inventory" onClick={(e) => e.stopPropagation()}>
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

export const InventoryModal: FC<Props> = ({ isShown, ...rest }) => (isShown ? <Sheet {...rest} /> : null);
