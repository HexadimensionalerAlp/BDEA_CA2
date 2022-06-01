import dotenv from 'dotenv';
import cassandra from 'cassandra-driver';
import neo4j from 'neo4j-driver';

dotenv.config();

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

export const getTestTableResults = async (): Promise<any> => {
    return cassandraClient.execute('select * from tweeter;');
    // return neo4jClient.run('match test');
}