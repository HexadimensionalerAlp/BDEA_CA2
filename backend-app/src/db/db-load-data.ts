import dotenv from 'dotenv';
import cassandra from 'cassandra-driver';
import neo4j from 'neo4j-driver';
import nReadlines from 'n-readlines';

const TWITTER_FOLLOWS_PATH = 'data/test-data/twitter_combined.txt'

dotenv.config();

const authProvider = new cassandra.auth.PlainTextAuthProvider(
    process.env.CASSANDRA_USER!,
    process.env.CASSANDRA_PASS!
);

const cassandraClient = new cassandra.Client({
    contactPoints: process.env.CASSANDRA_IPS!.split(','),
    localDataCenter: 'datacenter1',
    authProvider,
    keyspace: 'testspace'
});

const neo4jClient = neo4j.driver(process.env.NEO4J_IP!, neo4j.auth.basic(
    process.env.NEO4J_USER!,
    process.env.NEO4J_PASS!)).session();

export const loadAllDataIntoDBs = async (): Promise<boolean> => {
    // return cassandraClient.execute('select * from test;');
    // return neo4jClient.run('match test');
    return processFollows();
}

const processFollows = async (): Promise<boolean> => {
  const lines = new nReadlines(TWITTER_FOLLOWS_PATH);
  let followMap = new Map<string, string[]>();

  let line;

  await neo4jClient.run('(:User)-[:FOLLOWS]->(:User)');

  while (line = lines.next()) {
    const [user, follow] = line.toString().split(' ');
    const userEntry = followMap.get(user);

    if (!!userEntry) {
      followMap.set(user, [...userEntry, follow]);
    } else {
      followMap.set(user, [follow]);
      neo4jClient.run('(:User)-[:FOLLOWS]->(:User)');
    }
  }

  console.log(followMap.get('86775971'));


  return true;
}

