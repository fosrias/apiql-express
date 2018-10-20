# Proxy Example
A simple proxy service without persistent storage to demonstrate `apiql-express` functionality.

```
$ npm install
$ npm start
...
Target endpoint: http://localhost:8080/graphql
Example proxy listening on port 3000!

$ open http://localhost:3000/apiql/description
```

By default, this targets a GraphQL service at `http://localhost:8080/graphql`.

To proxy a different service, start by setting the following ENVARS:

```
$ export APIQL_TARGET_PROTOCOL=https (default: http)
$ export APIQL_TARGET_HOST=example.com (default: localhost)
$ export APIQL_TARGET_PORT=9000 (default: 8080)
$ export APIQL_TARGET_path=/my-graphql (default: /graphql)
$ npm start
...
Target endpoint: https://example.com:9000/my-graphql
Example proxy listening on port 3000!
```
