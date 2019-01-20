# APIQL Express
Giving API consumers the power of REST resources for `GraphQL` APIs.

> Work-in-progress - POC at this point, subject to lots of change
> * No tests yet
> * No permenant persistence yet
> * Does not check for uniqueness of resource paths between API descriptions yet


`apiql-express` is a light `expressjs` module that can be used in a proxy or a gateway in front of any `GraphQL` service, or in a Node.js-based `GraphQL` service to enable consumers to create any number of ad hoc REST resources using `GraphQL` queries and mutations as the configuration language. Just add it to any `expressjs` application to extend its functionality.

```
$ npm install apiql-express
```

```javascript
const apiql = require('apiql-express');
const express = require('express');

const app = express();
const port = 3000;

app.use(apiql());

app.listen(port, () => console.log(`Example proxy listening on port ${port}!`));
```

## Quick Start
You can try out out a [proxy example](examples/proxy/README) with the [Star Wars example server](https://github.com/apollographql/starwars-server) as follows:

In one terminal:
```
$ git clone git@github.com:apollographql/starwars-server.git
$ cd starwars-server
$ npm install
$ npm start
```

And in another terminal:
```
$ git clone git@github.com:fosrias/apiql-express.git
$ cd apiql-express/examples/proxy
$ npm install
$ npm start
```

### Trying it out
And in another terminal:
```
$ export $APIQL_HOST=http://localhost:3000
$ open $APIQL_HOST/apiql/api-description
$ cd path/to/apiql-express/root
$ curl --header "Content-Type: application/openapi+yaml" \
    --request PUT \
    --data "$(cat examples/star-wars-api.yml)" \
    $APIQL_HOST/apiql/apis/my-api
$ curl --header "Accept: application/openapi+yaml" $APIQL_HOST/apiql/apis/my-api
$ curl --header "Accept: application/openapi+json" $APIQL_HOST/apiql/apis/my-api
$ open $APIQL_HOST/apiql/apis/my-api
$ curl $APIQL_HOST/droids/2000
...
$ curl --header "Content-Type: application/json" \
    --request POST \
    --data '{ "review": {"stars": 5, "commentary": "This is a great movie!" }}' \
    $APIQL_HOST/episodes/JEDI/reviews
...
```

Viola!

## Creating ad hoc APIs
Basically, following API design-first principles, you define an OpenAPI 3.0 API Description document for your REST API. Currently,
responses are un-transformed `GraphQL` responses, so if you want to add components, they need be the expected `GraphQL` responses. Then, add a corresponding `GraphQL` query or mutation, an `x-graphqlQuery` or `x-graphqlMutation` extension string, respectively, to each opertion in the description document. The operationId MUST match the `GraphQL` query method name and any operation parameter names must exactly match any `GraphQL` `$` variables defined in your query or mutation strings. That's it.

```yaml
paths:
  /droids/{id}:
    get:
      description: Returns a Droid
      operationId: droidById
      parameters:
      - name: id
        in: path
        description: ID of a droid to fetch
        required: true
        schema:
          type: integer
          format: int64
      x-graphqlQuery: |
        query droidById($id: ID!) {  
          droid(id: $id) {
            name  
          }
        }
```

Checkout the [GraphQL docs](https://graphql.github.io/learn/) for more ideas on creating custom resources from `GraphQL` queries.

## Configuring GraphQL context
You can set the following envars to configure the target endpoint for the target `GraphQL` service as follows:

```
$ export APIQL_TARGET_PROTOCOL=https (default: http)
$ export APIQL_TARGET_HOST=example.com (default: localhost)
$ export APIQL_TARGET_PORT=9000 (default: 8080)
$ export APIQL_TARGET_PATH=/my-graphql (default: /graphql)
```

Alternately, you can set a context in your express application:

```javascript
const apiql = require('apiql-express');
const express = require('express');

const app = express();
const port = 3000;

const context = {
  targetProtocol: 'https',
  targetHost: 'example.com',
  targetPort: 8443,
  targetPath: 'my-graphql'
}

app.use(apiql(context));

app.listen(port, () => console.log(`Example proxy listening on port ${port}!`));
```

In the case of extending an `expressjs` `GraphQL` service with `apiql-express`, configure the target endpoint to be the service's own `GraphQL` endpoint.

## License
[MIT](LICENSE.md)

Thanks to [Stephen Mizell](https://twitter.com/stephen_mizell) for lots of good thoughts.
