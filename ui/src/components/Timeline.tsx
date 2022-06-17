import axios from 'axios';
import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NavBar } from './NavBar/NavBar';

const Timeline = () => {
  const [timeline, setTimeline] = useState<any[]>();
  const [searchParams] = useSearchParams();

  const [formUsername, setFormUsername] = useState('');
  const [username, setUsername] = useState(searchParams.get('username'));

  useEffect(() => {
    if (!username) return;
    axios
      .get(`http://localhost:80/timeline?username=${username}`)
      .then((res) => {
        setTimeline(res.data.data);
      })
      .catch((e) => console.log(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUsername(formUsername);
  };

  console.log('timeline', timeline);

  if (!(username && timeline)) {
    return (
      <>
        <NavBar />
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username: </label>
          <input
            id="username"
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            placeholder="Please enter a user name"
          />
          <br />
          <button type="submit">Enter</button>
        </form>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <h1>Timeline</h1>
      {timeline &&
        timeline.map((tweet) => {
          return (
            <>
              {tweet.msg} <br />
            </>
          );
        })}
    </>
  );
};

export { Timeline };
