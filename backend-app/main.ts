import express, { Express, Request, Response} from 'express';
import dotenv from 'dotenv';

import * as dbAccess from './src/db/db-access.js';
import * as dbPopulate from './src/db/db-load-data.js';

dotenv.config();

const port = process.env.PORT;

const app: Express = express();

app.get('/', (_req: Request, res: Response) => {
    res.send('Working!');
});

app.get('/profile/:user', async (req: Request, res: Response) => {
    const user: string = req.params.user;
    res.send(`TBD: show landing page of user ${user}, containing follower count, followed count and newest or most upvoted posts`);
});

app.get('/getPostsOfUser/:user', async (req: Request, res: Response) => {
    const user: string = req.params.user;
    res.send(`TBD: should list all posts of user ${user}`);
});

app.get('/top100mostFollowers/', async (req: Request, res: Response) => {
    res.send(`TBD: should list top 100 most followed accounts`);
});

app.get('/top100topFans/', async (req: Request, res: Response) => {
    res.send(`TBD: should list top 100 users who follow the most of the top 100 followed accounts`);
});

app.post('/top25PostsContainingWords/', async (req: Request, res: Response) => {
    // install body-parser
    res.send(`TBD: should list top 25 Posts containing a list of words`);
});

app.get('/test/', async (_req: Request, res: Response) => {
    res.send(await dbAccess.getTestTableResults());
});

app.get('/populateDBs/', async (_req: Request, res: Response) => {
    dbPopulate.loadAllDataIntoDBs();
    res.send('probably done');
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});