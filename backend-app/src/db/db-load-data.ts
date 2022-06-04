import dotenv from 'dotenv';
import cassandra from 'cassandra-driver';
import neo4j from 'neo4j-driver';
import nReadlines from 'n-readlines';
import fs from 'fs';
import { randomInt } from 'crypto';
import fetch from 'node-fetch';
import { parse } from 'csv-parse';
import { exec, execFile } from 'child_process';

const FOLLOWS_PATH = 'data/test-data/twitter_combined.txt'
const FOLLOWS_PROCESSED_PATH = 'data/test-data/follows.csv';
const USERS_PROCESSED_PATH = 'data/test-data/users.csv';
const POSTS_PATH = 'data/test-data/tweets.csv';
const POSTS_PROCESSED_PATH = 'data/test-data/posts.csv';
const POSTS_GRAPH_PROCESSED_PATH = 'data/test-data/posts-graph.csv';
const LIKES_PROCESSED_PATH = 'data/test-data/likes.csv';

const MAX_LIKES = 100;

dotenv.config();

type Post = {
  author: string;
  content: string;
  country: string;
  date_time: string;
  id: string;
  language: string;
  latitude: string;
  longitude: string;
  number_of_likes: string;
  number_of_shares: string;
};

const authProvider = new cassandra.auth.PlainTextAuthProvider(
    process.env.CASSANDRA_USER!,
    process.env.CASSANDRA_PASS!
);

const cassandraClient = new cassandra.Client({
    contactPoints: process.env.CASSANDRA_IPS!.split(','),
    localDataCenter: 'datacenter1',
    authProvider,
    keyspace: 'tweeter'
});

const neo4jClient = neo4j.driver(process.env.NEO4J_IP!, neo4j.auth.basic(
    process.env.NEO4J_USER!,
    process.env.NEO4J_PASS!)).session();

export const generateData = async (): Promise<string> => {
  const [mostFollowedUsers, allUsers] = await generateFollowsAndUsers();
  await generatePostsAndLikes(mostFollowedUsers, allUsers);
  return 'done';
}

const generateFollowsAndUsers = async (): Promise<[string[], string[]]> => {
  const lines = new nReadlines(FOLLOWS_PATH);
  const users = new Map<string, number>();

  let line;

  const followsExist = fs.existsSync(FOLLOWS_PROCESSED_PATH);
  const usersExist = fs.existsSync(USERS_PROCESSED_PATH);

  try {
    if (!followsExist) {
      fs.appendFileSync(FOLLOWS_PROCESSED_PATH, 'userid,followid\n');
    }
    if (!usersExist) {
      fs.appendFileSync(USERS_PROCESSED_PATH, 'id,name\n');
    }

    while (line = lines.next()) {
      const [user, follow] = line.toString().split(' ');
      const followerCount = users.get(follow);
  
      if (!!followerCount) {
        users.set(follow, followerCount + 1);
      } else {
        users.set(follow, 1);
      }
  
      if (!followsExist) {
        fs.appendFileSync(FOLLOWS_PROCESSED_PATH, `${user},${follow}\n`);
      }
    }

    console.log('***************** finished follows *****************');
    
    if (!usersExist) {
      const [maleResponse, femaleResponse] = await Promise.all([fetch(`https://www.randomlists.com/data/names-male.json`),
        fetch(`https://www.randomlists.com/data/names-female.json`)]);
      const [nameListMale, nameListFemale] = await Promise.all([maleResponse.json() as any, femaleResponse.json() as any]);
      const combinedList = nameListMale.data.concat(nameListFemale.data);
  
      console.log('***************** fetched name lists *****************');
    
      for (const user of users) {
        fs.appendFileSync(USERS_PROCESSED_PATH, `${user[0]},${combinedList[randomInt(0, combinedList.length)]}\n`);
      }
  
      console.log('***************** finished users *****************');
    }
  } catch (error) {
    console.log(error);
  }

  return [Array.from(users.entries()).sort((a, b) => b[1] - a[1]).slice(0, 100).map(e => e[0]), Array.from(users.keys())];
}

const generatePostsAndLikes = async (mostFollowedUsers: string[], allUsers: string[]): Promise<void> => {
  const postsExist = fs.existsSync(POSTS_PROCESSED_PATH);
  const likesExist = fs.existsSync(LIKES_PROCESSED_PATH);
  const postsGraphExist = fs.existsSync(POSTS_GRAPH_PROCESSED_PATH);

  if (postsExist) {
    fs.truncateSync(POSTS_PROCESSED_PATH, 0);
  }

  if (likesExist) {
    fs.truncateSync(LIKES_PROCESSED_PATH, 0);
  }
  
  fs.appendFileSync(POSTS_PROCESSED_PATH, 'userid,postid,content\n');
  fs.appendFileSync(LIKES_PROCESSED_PATH, 'userid,postid\n');

  if (!postsGraphExist) {
    fs.appendFileSync(POSTS_GRAPH_PROCESSED_PATH, 'id\n');
  }

  try {
    const headers = ['author', 'content', 'country', 'date_time', 'id', 'language', 'latitude', 'longitude', 'number_of_likes', 'number_of_shares'];
    parse(fs.readFileSync(POSTS_PATH), { delimiter: ',', columns: headers, fromLine: 2 }, (err, results: Post[]) => {
      if (err) {
        console.error(err);
      }
      else {
        for (const post of results) {
          const date_time = cassandra.types.TimeUuid.fromDate(new Date(post.date_time));
          if (!postsGraphExist) {
            fs.appendFileSync(POSTS_GRAPH_PROCESSED_PATH, `${date_time}\n`);
          }
          fs.appendFileSync(POSTS_PROCESSED_PATH, `${mostFollowedUsers[randomInt(0, mostFollowedUsers.length)]},${date_time},"${post.content.replaceAll('"', '""')}"\n`);

          const usedUsers: string[] = [];

          while (usedUsers.length < randomInt(1, MAX_LIKES)) {
            const user = allUsers[randomInt(0, allUsers.length)];

            if (!usedUsers.includes(user)) {
              fs.appendFileSync(LIKES_PROCESSED_PATH, `${user},${date_time}\n`);
              usedUsers.push(user);
            }
          }
        }
        console.log('***************** finished posts and likes *****************');
      }
    });
  } catch (error) {
    console.log(error);
  }
}

export const writeToDBs = async (): Promise<void> => {
  try {
    exec('copy-data.sh', async (error, _stdout, _stderr) => {
      if (error) {
        throw error;
      }
      console.log('***************** start writing to dbs *****************');
      
      await neo4jClient.run(`MATCH (n) DETACH DELETE n`);
      
      console.log('***************** cleared neo4j *****************');
  
      await neo4jClient.run(`
      // load User nodes
      USING PERIODIC COMMIT 500
      LOAD CSV WITH HEADERS FROM 'file:///users.csv' AS row
      MERGE (u:User {id: row.id, name: row.name})
      RETURN count(u)`);

      console.log('***************** wrote User *****************');
  
      await neo4jClient.run(`
      // load posts
      USING PERIODIC COMMIT 500
      LOAD CSV WITH HEADERS FROM 'file:///posts-graph.csv' AS row
      MERGE (p:Post {id: row.id})
      RETURN count(p)`);

      console.log('***************** wrote Post *****************');

      await neo4jClient.run(`
      // create relationships
      USING PERIODIC COMMIT 500
      LOAD CSV WITH HEADERS FROM 'file:///follows.csv' AS row
      MATCH (u:User {id: row.id})
      MATCH (f:User {id: row.followid})
      MERGE (u)-[:FOLLOWS]->(f)
      RETURN * limit 10`);
      
      console.log('***************** wrote FOLLOWS *****************');
  
      await neo4jClient.run(`
      // create relationships
      USING PERIODIC COMMIT 500
      LOAD CSV WITH HEADERS FROM 'file:///likes.csv' AS row
      MATCH (u:User {id: row.userid})
      MATCH (p:Post {id: row.postid})
      MERGE (u)-[:LIKES]->(p)
      RETURN * limit 10`);
      
      console.log('***************** wrote LIKES *****************');
  
      await cassandraClient.execute(`CREATE TABLE IF NOT EXISTS posts_by_user(
        postid timeuuid,
        userid bigint,
        content text,
        PRIMARY KEY (userid, postid)
      ) WITH CLUSTERING ORDER BY (postid DESC);`);
      
      await cassandraClient.execute(`COPY posts_by_user (userid, postid, content) FROM 'posts.csv' WITH HEADER = true;`);
      
      console.log('***************** wrote Posts cass *****************');
    });
  } catch (error) {
    console.log(error);
  }
}

