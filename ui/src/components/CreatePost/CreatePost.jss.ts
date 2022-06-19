import { createUseStyles } from 'react-jss';

const styles = {
  label: {
    display: 'flex',
    width: '5rem',
  },

  input: {
    width: '10rem',
  },

  wrap: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: '1rem',
  },
};

const useStyles = createUseStyles(styles, { name: 'CreatePost' });

export default useStyles;
