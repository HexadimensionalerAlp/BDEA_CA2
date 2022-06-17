import { createUseStyles } from 'react-jss';

const styles = {
  wrap: {
    display: 'flex',
    background: '#0058A5',
  },

  item: {
    padding: '1rem',
    textDecoration: 'none',
    color: 'white',
    transition: '0.75s',

    '&:hover': {
      background: '#4A7C9E',
    },
  },
};

const useStyles = createUseStyles(styles, { name: 'NavBar' });

export default useStyles;
