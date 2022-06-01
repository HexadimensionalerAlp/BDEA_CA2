FROM cassandra:latest
COPY create-keyspace.sh /create-keyspace.sh
ENTRYPOINT ["/create-keyspace.sh"]
CMD ["cassandra", "-f"]