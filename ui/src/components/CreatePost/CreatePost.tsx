import axios from 'axios';
import { FormEvent, useState } from 'react';
import { NavBar } from '../NavBar/NavBar';
import useStyles from './CreatePost.jss';

const CreatePost = () => {
  const classes = useStyles();

  const [message, setMessage] = useState('');
  const [authorId, setAuthorId] = useState('27025598');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    axios.post(`http://localhost:80/createPost`, { message, authorId });
  };

  // 27025598 schreibt fanout in: 23666930, 87233826, 15737386, 168790039, 168790039

  return (
    <>
      <NavBar />
      <h1>Create Post</h1>
      <form onSubmit={handleSubmit}>
        <div className={classes.wrap}>
          <label className={classes.label} htmlFor="author">
            AuthorId:{' '}
          </label>
          <input
            className={classes.input}
            id="author"
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
          />
        </div>

        <div className={classes.wrap}>
          <label className={classes.label} htmlFor="message">
            Message:{' '}
          </label>
          <input
            className={classes.input}
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <button type="submit">Submit</button>
      </form>
    </>
  );
};

export { CreatePost };
