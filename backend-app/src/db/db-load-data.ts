// Die nachfolgende Datei wird über den Endpunkt localhost/generateData bzw. localhost/writeDataToDBs aufgerufen. Sie ist Teil der NodeJs-Anwendung und dient zum
// Vorverarbeiten und Generieren von Daten, sowie dem Schreiben der Daten in die Datenbanken.

import dotenv from 'dotenv';
import cassandra from 'cassandra-driver';
import neo4j, { Integer } from 'neo4j-driver';
import nReadlines from 'n-readlines';
import fs from 'fs';
import { randomInt } from 'crypto';
import fetch from 'node-fetch';
import { parse } from 'csv-parse';
import { execSync } from 'child_process';

const FOLLOWS_PATH = 'data/test-data/twitter_combined.txt';
const FOLLOWS_PROCESSED_PATH = 'data/test-data/follows.csv';
const USERS_PROCESSED_PATH = 'data/test-data/users.csv';
const POSTS_PATH = 'data/test-data/tweets.csv';
const POSTS_PROCESSED_PATH = 'data/test-data/posts.csv';
const POSTS_GRAPH_PROCESSED_PATH = 'data/test-data/posts-graph.csv';
const LIKES_PROCESSED_PATH = 'data/test-data/likes.csv';

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
  keyspace: 'tweeter',
});

const neo4jClient = neo4j
  .driver(
    process.env.NEO4J_IP!,
    neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASS!)
  )
  .session();

// wird vom Endpunkt localhost/generateData aufgerufen
export const generateData = async (): Promise<string> => {
  const [mostFollowedUsers, allUsers] = await generateFollowsAndUsers();
  await generatePostsAndLikes(mostFollowedUsers, allUsers);
  return 'done';
};

// generiert die Dateien users.csv und follows.csv nur neu, wenn sie noch nicht vorhanden sind, da dies länger dauert
// und jeder Durchgang den gleichen Inhalt generiert.
// gibt eine Liste mit den Hundert Usern mit den meisten Followern und eine Liste aller User zurück.
const generateFollowsAndUsers = async (): Promise<[string[], string[]]> => {
  const lines = new nReadlines(FOLLOWS_PATH);
  const users = new Map<string, number>();

  let line;

  const followsExist = fs.existsSync(FOLLOWS_PROCESSED_PATH);
  const usersExist = fs.existsSync(USERS_PROCESSED_PATH);

  try {
    // schreibt die header
    if (!followsExist) {
      fs.appendFileSync(FOLLOWS_PROCESSED_PATH, 'userid,followid\n');
    }
    if (!usersExist) {
      fs.appendFileSync(USERS_PROCESSED_PATH, 'id,name\n');
    }

    // liest die follows.txt Zeile für Zeile, wandelt den Inhalt in eine CSV-Zeile um und schreibt diese in die follows.csv
    // schreibt alle User in eine Map und zählt ihre Follower
    while ((line = lines.next())) {
      const [user, follow] = line.toString().split(' ');
      const followerCount = users.get(follow);

      if (!!followerCount) {
        users.set(follow, followerCount + 1);
      } else {
        users.set(follow, 1);
      }

      if (!followsExist) {
        const line = `${user},${follow}`;
        fs.appendFileSync(
          FOLLOWS_PROCESSED_PATH,
          `${line.replaceAll('\n', '').replaceAll('\r', '')}\n`
        );
      }
    }

    console.log('***************** finished follows *****************');

    // holt eine Liste mit Vornamen aus dem Internet und speichert die Ids der User zusammen mit einem zufällig ausgewählten Vornamen in der users.csv
    if (!usersExist) {
      const [maleResponse, femaleResponse] = await Promise.all([
        fetch(`https://www.randomlists.com/data/names-male.json`),
        fetch(`https://www.randomlists.com/data/names-female.json`),
      ]);
      const [nameListMale, nameListFemale] = await Promise.all([
        maleResponse.json() as any,
        femaleResponse.json() as any,
      ]);
      const combinedList = nameListMale.data.concat(nameListFemale.data);

      console.log('***************** fetched name lists *****************');

      for (const user of users) {
        const line = `${user[0]},${
          combinedList[randomInt(0, combinedList.length)]
        }`;
        fs.appendFileSync(
          USERS_PROCESSED_PATH,
          `${line.replaceAll('\n', '').replaceAll('\r', '')}\n`
        );
      }

      console.log('***************** finished users *****************');
    }
  } catch (error) {
    console.log(error);
  }

  return [
    Array.from(users.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map((e) => e[0]),
    Array.from(users.keys()),
  ];
};

// generiert die Dateien posts.csv und likes.csv jedes Mal neu, posts-graph.csv nur wenn noch nicht vorhanden, da sich an den Ids der Posts nichts ändert.
// bei posts.csv werden die Posts bei jedem Durchlauf zufälligen Nutzern zugewiesen, in der likes.csv die Likes zufällig verteilt.
const generatePostsAndLikes = async (
  mostFollowedUsers: string[],
  allUsers: string[]
): Promise<void> => {
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
    const headers = [
      'author',
      'content',
      'country',
      'date_time',
      'id',
      'language',
      'latitude',
      'longitude',
      'number_of_likes',
      'number_of_shares',
    ];
    // Einlesen der tweets.csv
    parse(
      fs.readFileSync(POSTS_PATH),
      { delimiter: ',', columns: headers, fromLine: 2 },
      (err, results: Post[]) => {
        if (err) {
          console.error(err);
        } else {
          for (const post of results) {
            // jeder Post wird auf die nötigen Daten reduziert, bekommt einen der hundert Usern mit den meisten Followern zugewiesen
            // und date_time wird zu einer Cassandra-timeuuid konvertiert
            const date_time = cassandra.types.TimeUuid.fromDate(
              new Date(post.date_time)
            );

            // die Datei posts-graph.csv besteht aus nur einer Spalte. Sie ist nur dafür da, die Posts in neo4j für die LIKES-Beziehung bereitzustellen
            if (!postsGraphExist) {
              const line = `${date_time}`;
              fs.appendFileSync(
                POSTS_GRAPH_PROCESSED_PATH,
                `${line.replaceAll('\n', '').replaceAll('\r', '')}\n`
              );
            }
            const line = `${
              mostFollowedUsers[randomInt(0, mostFollowedUsers.length)]
            },${date_time},"${post.content.replaceAll('"', '')}"`;
            fs.appendFileSync(
              POSTS_PROCESSED_PATH,
              `${line.replaceAll('\n', '').replaceAll('\r', '')}\n`
            );

            const usedUsers: string[] = [];

            // jedem Post wird ein Hundertstel der Likes die er eigentlich hat zufällig zugewiesen. Dies geschieht, um die Dauer für das Generieren in einem erträglichen Maß zu halten.
            // Dabei wird darauf geachtet, dass kein User den selben Post zweimal liket.
            while (usedUsers.length < parseInt(post.number_of_likes) / 1000) {
              const user = allUsers[randomInt(0, allUsers.length)];

              if (!usedUsers.includes(user)) {
                const line = `${user},${date_time}`;
                fs.appendFileSync(
                  LIKES_PROCESSED_PATH,
                  `${line.replaceAll('\n', '').replaceAll('\r', '')}\n`
                );
                usedUsers.push(user);
              }
            }
          }
          console.log(
            '***************** finished posts and likes *****************'
          );
        }
      }
    );
  } catch (error) {
    console.log(error);
  }
};

// wird vom Endpunkt localhost/writeDataToDBs aufgerufen
export const writeToDBs = async (): Promise<string> => {
  let result = 'successfully done';
  try {
    // kopiert die generierten CSV-Dateien in die jeweiligen Container
    execSync(`docker cp data/test-data/posts.csv cass_1:posts.csv`);
    execSync(`docker cp data/test-data/posts.csv cass_2:posts.csv`);
    execSync(`docker cp data/test-data/follows.csv neo4j_1:follows.csv`);
    execSync(`docker cp data/test-data/users.csv neo4j_1:users.csv`);
    execSync(
      `docker cp data/test-data/posts-graph.csv neo4j_1:posts-graph.csv`
    );
    execSync(`docker cp data/test-data/likes.csv neo4j_1:likes.csv`);
    execSync(`docker cp data/test-data/posts.csv neo4j_1:posts.csv`);

    console.log('***************** start writing to dbs *****************');

    // Löschen aller Einträge in der neo4j-Datenbank
    await neo4jClient.run(`MATCH (n) DETACH DELETE n`);

    console.log('***************** cleared neo4j *****************');
    // Erstellen der Constraints für die Primärschlüssel in der neo4j-Datenbank
    await neo4jClient.run(
      `CREATE CONSTRAINT constraint_user IF NOT EXISTS ON (n:User) ASSERT n.id IS UNIQUE`
    );
    await neo4jClient.run(
      `CREATE CONSTRAINT constraint_post IF NOT EXISTS ON (n:Post) ASSERT n.id IS UNIQUE`
    );

    console.log('***************** created constraints *****************');

    // Schreiben der User-Nodes in die neo4j-Datenbank
    await neo4jClient.run(`
    USING PERIODIC COMMIT 500
    LOAD CSV WITH HEADERS FROM 'file:///users.csv' AS row
    MERGE (u:User {id: row.id, name: row.name})
    RETURN count(u)`);

    console.log('***************** wrote User *****************');

    // Schreiben der Posts-Nodes in die neo4j-Datenbank
    await neo4jClient.run(`
    USING PERIODIC COMMIT 500
    LOAD CSV WITH HEADERS FROM 'file:///posts-graph.csv' AS row
    MERGE (p:Post {id: row.id})
    RETURN count(p)`);

    console.log('***************** wrote Post *****************');

    // Erstellen der FOLLOWS-Beziehung zwischen Usern
    await neo4jClient.run(`
    USING PERIODIC COMMIT 500
    LOAD CSV WITH HEADERS FROM 'file:///follows.csv' AS row
    MATCH (u:User {id: row.userid})
    MATCH (f:User {id: row.followid})
    MERGE (u)-[:FOLLOWS]->(f)`);

    console.log('***************** wrote FOLLOWS *****************');

    // Erstellen der LIKES-Beziehung zwischen Usern und Posts
    await neo4jClient.run(`
    USING PERIODIC COMMIT 500
    LOAD CSV WITH HEADERS FROM 'file:///likes.csv' AS row
    MATCH (u:User {id: row.userid})
    MATCH (p:Post {id: row.postid})
    MERGE (u)-[:LIKES]->(p)`);

    console.log('***************** wrote LIKES *****************');

     // Erstellen der POSTS-Beziehung zwischen Usern und Posts
     await neo4jClient.run(`
     USING PERIODIC COMMIT 500
     LOAD CSV WITH HEADERS FROM 'file:///posts.csv' AS row
     MATCH (u:User {id: row.userid})
     MATCH (p:Post {id: row.postid})
     MERGE (u)-[:POSTS]->(p)`);
 
     console.log('***************** wrote POSTS *****************');

    // Erstellen der posts_by_user-Tabelle in Cassandra
    await cassandraClient.execute(`CREATE TABLE IF NOT EXISTS posts_by_user(
      postid timeuuid,
      userid bigint,
      content text,
      PRIMARY KEY (userid, postid, content)
    ) WITH CLUSTERING ORDER BY (postid DESC);`);

    // Schreiben der Posts in die posts_by_user-Tabelle in Cassandra
    execSync(
      `docker exec cass_1 cqlsh -e "use tweeter; COPY posts_by_user (userid, postid, content) FROM 'posts.csv' WITH HEADER = true;"`
    );

    console.log('***************** wrote Posts cass *****************');
    console.log(
      '***************** finished writing data to DBs *****************'
    );
  } catch (error) {
    result = '' + error;
    console.log(error);
  }

  return result;
};

export const getTimeline = async (authorId: string) => {
  const res = await neo4jClient.run(
    `match (n:User) where n.id = '${authorId}' return n;`
  );

  return res;
};

export const fanOut = async (tweet: any) => {
  const allUsersResult = await neo4jClient.run(
    `match (u:User)-[f:FOLLOWS]->(m:User) where m.id = '${tweet.authorId}' return u, f, m;`
  );
  const nodes = allUsersResult.records;

  const userIds: number[] = [];

  nodes.forEach((node) => userIds.push(parseInt(node.get(0).properties.id)));

  console.log('userIds', userIds);

  for (const userId of userIds) {
    const userResult = await neo4jClient.run(
      `match (u:User) where u.id = '${userId}' return u;`
    );

    const timeline: string = userResult.records[0].get(0).properties.timeline;
    if (!!timeline) {
      const timelineJSON = JSON.parse(timeline);
      timelineJSON.data.push(tweet);
      const newTimeline = JSON.stringify(timelineJSON);
      await neo4jClient.run(
        `match (u:User) where u.id = '${userId}' set u.timeline = '${newTimeline}';`
      );
    } else {
      const timeline: any = { data: [] };
      timeline.data.push(tweet);
      await neo4jClient.run(
        `match (u:User) where u.id = ${userId} set u.timeline = '${JSON.stringify(
          timeline
        )}';`
      );
    }
  }
};

//Abfrage 1
export const getPostsOfUser = async (user: string) => {
  const cass = await cassandraClient.execute(
    `select content from posts_by_user where userid = ${user};`
  );
  var result: string = '';
  for (const row of cass.rows) {
    result += row.get(0) + "\n"; 
  }
  return result;
}

//Abfrage 2
export const getTop100mostFollowers = async () => {
  const neo = await neo4jClient.run(`match (u1:User)<-[:FOLLOWS]-(u2:User) return u1, 
                                     count(u2) as followers order by followers desc limit 100`
  );
  const map = new Map();
  //return neo.records[0];
  neo.records.forEach((node) => map.set(node.get(0).properties, node.get(1).low));
  return [...map.entries()];
}

//Abfrage 3
export const getTop100TopFans = async () => {
  //Ausgabearray
  var arr = new Array(0);
  const neo = await neo4jClient.run(
    `CALL { 
      match (u1:User)<-[:FOLLOWS]-(u2:User)
	    return u1, count(u2) as followers
		  order by followers desc limit 100
	  }
	  match (u3:User)-[:FOLLOWS]->(u1)
	  return u3, count(u1) as followingInTop100
	  order by followingInTop100 desc limit 100`
  );
  neo.records.forEach(function(element) {
    arr.push('NAME:'+element.get(0).properties.name+','+'ID:'+element.get(0).properties.id+','+
    'FOLLOWING ' + element.get(1) + ' PEOPLE IN TOP 100');
  });
  return arr;
}

//Abfrage 4  (1)
export const getProfileOfUser = async (user: string) => {
  //Ausgabearray
  var arr = new Array(0);
  //Abfrage, 4.1
  const neo = await neo4jClient.run(
    `match (u1:User {id: "${user}"})<-[:FOLLOWS]-(u2:User) return count(u2) as followers` 
  );
  arr.push('FOLLOWER COUNT:' + neo.records[0].get(0).low);

  //Abfrage, 4.2
  const neo2 = await neo4jClient.run(
    `match (u1:User {id: "${user}"})-[:FOLLOWS]->(u2:User) return count(u2) as following`
  )  
  arr.push('FOLLOWING ' + neo2.records[0].get(0).low + ' people');
  arr.push('TOP POSTS OF FOLLOWED PEOPLE:');
  
  //Abfrage 4.3
    //Abfrage, 4.3.1
    //Aus neo4j werden die top Posts der gefolgten Leute samt Likes ermittelt
    const neo3 = await neo4jClient.run(
      `match (u1:User {id: "${user}"})-[:FOLLOWS]->(u2:User) match (u2)-[:POSTS]->(p:Post)
       match l=()-[:LIKES]->(p) return u2, p.id, count(l) as likes order by likes desc limit 25`
    );
  
    //Die ermittelten postids werden in ein Array mit ihrer Ordnung (in neo4j) gepackt
    var arrCass = new Array(0);
    for (const record of neo3.records) {
      arrCass.push(record.get(1));
    }  

    //Mit jeder der geordneten ids wird ein select ausgeführt, der Ergbenistweet dann in ein neues Array gepackt
    var arrContent = new Array(0);
    for (const element of arrCass) {
      const content = await cassandraClient.execute('select content from posts_by_user where postid = ' + element +' ALLOW FILTERING;');
      arrContent.push(content.rows[0].get(0));
    }

    //Für jedes aus neo4j enthaltene Element werden gewisse Daten genommen, mit dem Ergbenis aus Cassandra vereint und in ein weiteres Array gepusht
    var i: number = 0;
    neo3.records.forEach(function(element) {
      arr.push('NAME:'+element.get(0).properties.name+','+'ID:'+element.get(0).properties.id+','+
      'POST:'+arrContent[i]+','+'LIKES:'+element.get(2).low);
      i++;
    });
  //Das finale Array wird ausgegeben
  return arr;//cass.rows;
}
//Abfrage 4 (2)
export const getProfileOfUser2 = async (user: string) => {
  //Ausgabearray
    var arr = new Array(0);
  //Abfrage, 4.1
  const neo = await neo4jClient.run(
    `match (u1:User {id: "${user}"})<-[:FOLLOWS]-(u2:User) return count(u2) as followers` 
  );
  arr.push('FOLLOWER COUNT:' + neo.records[0].get(0).low);

  //Abfrage, 4.2
  const neo2 = await neo4jClient.run(
    `match (u1:User {id: "${user}"})-[:FOLLOWS]->(u2:User) return count(u2) as following`
  )  
  arr.push('FOLLOWING ' + neo2.records[0].get(0).low + ' people');
  arr.push('NEWEST POSTS OF FOLLOWED PEOPLE:');

  //Abfrage 4.3
    //Abfrage 4.3.2
    //Aus neo4j werden die top Posts der gefolgten Leute mit Likes ermittelt, aber ohne Sortierung
    const neo3 = await neo4jClient.run(
      `match (u1:User {id: "${user}"})-[:FOLLOWS]->(u2:User) match (u2)-[:POSTS]->(p:Post)
        match l=()-[:LIKES]->(p) return u2, p.id, count(l) as likes`
    );
    var arrCass = new Array(0);
    for (const record of neo3.records) {
      arrCass.push(record.get(1));
    }

    //Herstellung des Parameters der IN-Operation in Cassandra
    var stringCass: string = '';
    for (const element of arrCass) {
      stringCass += element + ',';
    }
    stringCass = stringCass.slice(0, stringCass.length-1);

    //Cassandraabfrage zur Lieferung der contents geordnet nach Datum (Tuuid)
    const cass = await cassandraClient.execute('select userid, postid, content from posts_by_user where postid in (' + stringCass + ') limit 25 ALLOW FILTERING;')
    
    //Die ermittelten postids werden in ein Array mit ihrer Ordnung (in Cassandra) gepackt
    var arrCassPostId = new Array(0);
    for (const row of cass.rows) {
      arrCassPostId.push(row.get(1));
    }

    var arrCassPostContent = new Array(0);
    for (const row of cass.rows) {
      arrCassPostContent.push(row.get(2));
    }

    var arrCassPostUser = new Array(0);
    for (const row of cass.rows) {
      arrCassPostUser.push(row.get(0));
    }

    //Einzelne matches in neo4j, da die Ordnung dieses Mal von Cassandra vorgegeben wird
    var arrNeoUserName = new Array(0);
    var arrNeoLikes = new Array(0);
    for (const element of arrCassPostId) {
      const content = await neo4jClient.run(`match (p:Post {id: "`+element+`"}) match (u:User)-[:POSTS]->(p) match l=()-[:LIKES]->(p) return u, count(l)`);
      arrNeoUserName.push(content.records[0].get(0).properties.name);
      arrNeoLikes.push(content.records[0].get(1));
    }
  
    //Die geordneten Posts aus Cassandra werden mit den aus neo4j erhaltenen, geordneten Daten vereint im finalen array, das wird dann ausgegeben
    var i: number = 0;
    for(const row of cass.rows) {
      arr.push('NAME: '+arrNeoUserName[i]+'ID: '+arrCassPostUser[i]+'POST: '+arrCassPostContent[i]+'LIKES: '+arrNeoLikes[i]);
      //arr.push('NAME and ID:'+arrNeoUser[i]+', POST:'+arrCassPostContent[i]+', LIKES:'+arrNeoLikes[i]);
      i++;
    }
  return arr;
}

//export const getTopPostsContainingWords = async (word: string) => {

//}



/*export const testNeo = async () => {
   const res =  await neo4jClient.run('match (u:User {id: "462559272"}) return u');
   const node = res.records[0].get(0).properties;
   return node;
};*/
