import React, { ReactElement, FC } from "react";
 
// define interface to represent component props
interface Props {
  title: String;
  action?: ReactElement; // something at the right edge (the GM button)
}
 
const Header: FC<Props> = ({ title, action }): ReactElement => {
  return <header id="header"><h1>{title}</h1>{action}</header>;
};
 
export default Header;