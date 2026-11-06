import React, { ReactElement, FC } from "react";
 
// define interface to represent component props
interface Props {
  title: String;
}
 
const Header: FC<Props> = ({ title }): ReactElement => {
  return <header id="header"><h1>{title}</h1></header>;
};
 
export default Header;