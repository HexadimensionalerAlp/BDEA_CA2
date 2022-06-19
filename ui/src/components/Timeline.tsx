import axios from 'axios';
import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NavBar } from './NavBar/NavBar';

const Timeline = () => {
  const [timeline, setTimeline] = useState<any[]>();
  const [searchParams] = useSearchParams();

  const [formAuthorId, setFormAuthorId] = useState('');
  const [authorId, setauthorId] = useState(searchParams.get('authorId'));

  useEffect(() => {
    if (!authorId) return;
    axios
      .get(`http://localhost:80/timeline?authorId=${authorId}`)
      .then((res) => {
        setTimeline(res.data.data);
      })
      .catch((e) => console.log(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setauthorId(formAuthorId);
  };

  console.log('timeline', timeline);

  if (!(authorId && timeline)) {
    return (
      <>
        <NavBar />
        <form onSubmit={handleSubmit}>
          <label htmlFor="authorId">authorId: </label>
          <input
            id="authorId"
            value={formAuthorId}
            onChange={(e) => setFormAuthorId(e.target.value)}
            placeholder="Please enter a author id"
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
              <div>{tweet.message}</div>
              <br />
            </>
          );
        })}
    </>
  );
};

export { Timeline };
