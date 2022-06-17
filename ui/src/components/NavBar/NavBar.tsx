import { Link } from 'react-router-dom';
import useStyles from './NavBar.jss';

const NavBar = () => {
  const classes = useStyles();

  return (
    <div className={classes.wrap}>
      <Link className={classes.item} to="/">
        Home
      </Link>
      <Link className={classes.item} to="/timeline">
        Timeline
      </Link>
    </div>
  );
};

export { NavBar };
