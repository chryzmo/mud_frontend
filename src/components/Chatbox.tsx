import { FC,ReactElement } from "react";

// define interface to represent component props
interface Props {
}



const Chatbox : FC<Props> = () : ReactElement => {

    return (
        <div id="chatdiv">
            <div id="chatbox">
            </div>
        </div>
    )
};

export default Chatbox;