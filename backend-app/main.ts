import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import * as dbAccess from './src/db/db-access.js';
import * as dbPopulate from './src/db/db-load-data.js';

dotenv.config();

const port = process.env.PORT;

const app: Express = express();
app.use(
  cors({
    origin: '*',
  })
);
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.send('Working!');
});

app.get('/profile/:user', async (req: Request, res: Response) => {
  const user: string = req.params.user;
  console.log(user);
  res.send(await dbPopulate.getProfileOfUser(user));
});

app.get('/profile2/:user', async (req: Request, res: Response) => {
  const user: string = req.params.user;
  console.log(user);
  res.send(await dbPopulate.getProfileOfUser2(user));
});

app.get('/getPostsOfUser/:user', async (req: Request, res: Response) => {
  const user: string = req.params.user;
  res.send(await dbPopulate.getPostsOfUser(user));
});

app.get('/top100mostFollowers/', async (req: Request, res: Response) => {
  res.send(await dbPopulate.getTop100mostFollowers());
});

app.get('/top100topFans/', async (req: Request, res: Response) => {
  res.send(await dbPopulate.getTop100TopFans());
});

app.post('/top25PostsContainingWords/', async (req: Request, res: Response) => {
  // install body-parser
  res.send(`TBD: should list top 25 Posts containing a list of words`);
});

app.get('/generateData/', async (_req: Request, res: Response) => {
  res.send(await dbPopulate.generateData());
});

app.get('/writeDataToDBs/', async (_req: Request, res: Response) => {
  res.send(await dbPopulate.writeToDBs());
});

/* app.get('/testFanout', async (req: Request, res: Response) => {
  await dbPopulate.fanOut();

  res.send('Nothing to show here');
}); */

app.get('/timeline', async (req: Request, res) => {
  const query = await dbPopulate.getTimeline(req.query.authorId as string);
  const result = query.records[0].get(0).properties.timeline;
  res.status(200).send(result);
});

app.post('/createPost', async (req: Request, res: Response) => {
  console.log('createPost called', req.body);

  await dbPopulate.fanOut(req.body);

  res.send();
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
