import logo from "../assets/Logo.png";

function Header() {
  return (
    <header className="header">
      <img className="logo" src={logo} alt="LOGO" />
    </header>
  );
}

export default Header;
