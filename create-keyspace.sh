#!/bin/bash

CQL="CREATE KEYSPACE IF NOT EXISTS tweeter WITH REPLICATION = {'class': 'SimpleStrategy', 'replication_factor': 2};"
until echo $CQL | cqlsh; do
  echo "cqlsh: Cassandra is unavailable - retry later"
  sleep 2
done &

exec /usr/local/bin/docker-entrypoint.sh "$@"