docker cp data/test-data/posts.csv cass_1:posts.csv
docker cp data/test-data/posts.csv cass_2:posts.csv
docker cp data/test-data/follows.csv neo4j_1:follows.csv
docker cp data/test-data/users.csv neo4j_1:users.csv
docker cp data/test-data/posts-graph.csv neo4j_1:posts-graph.csv
docker cp data/test-data/likes.csv neo4j_1:likes.csv