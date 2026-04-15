import {FC, useEffect} from "react";
import {createPortal} from "react-dom";
import * as MUDCONST from "../utils/constants";

// define interface to represent component props
interface Props {
    isShown: boolean;
    hide: () => void;
    msgText: string;
    setMessage: React.Dispatch<React.SetStateAction<string>>;
}

//export const Modal: FunctionComponent<ModalProps> = ({
export const InventoryModal: FC<Props> = ({ isShown, hide, msgText, setMessage }) => {
    // Override "Enter" key behavior to close modal
    const onKeyDown = (event: KeyboardEvent) => {
        if ((event.key === "Enter" || event.key == "Escape") && isShown) {
          hide();
        }
    };

    // Set up useEffect to close InventoryModal on "Enter" key
    useEffect(() => {
        isShown
            ? (document.body.style.overflow = "hidden")
            : (document.body.style.overflow = "unset");
        document.addEventListener("keydown", onKeyDown, false);
        return () => {
            document.removeEventListener("keydown", onKeyDown, false);
        };
    }, [isShown]);

    // Allow items to be interactive
    const handleInventoryItemClick = (arg : string) => () => {
        //let regex = /^.*x /
        let item = arg.replace(/^.*x /,'');
        setMessage("EXAMINE MY " + item)
        hide();
    }

    // Create array of inventory items.  We will map these later
    let msglines = msgText.replace('Your inventory contains:','').split('\n');

    const modal = (
        <div className="inventorymodal">
            <div className="inventorymodalheader">Your inventory contains:</div><br/>
            {
                msglines.map(function (data) {
                    let invline = data.replace(MUDCONST.MUDCOLOR.ESCAPE_START+MUDCONST.MUDCOLOR.GREEN,'').replace(MUDCONST.MUDCOLOR.ESCAPE_END,'');

                    return (
                        <div onClick={handleInventoryItemClick(invline)} className="inventorymodaltext"><span className='itemNameSpan'>{invline}</span></div>
                    )
                })
            }
            <button onClick={hide}>Close</button>
        </div>
    )

    return isShown ? createPortal(modal, document.body) : null;
}
