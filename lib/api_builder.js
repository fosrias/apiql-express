/**
 *  Copyright (c) 2018 Mark W. Foster
 *
 *  This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

'use strict';

const
  API = require('./api'),
  async = require('async'),
  bodyParser = require('body-parser'),
  { NOT_FOUND } = require('./constants'),
  request = require('request'),
  _ = require('lodash'),

  GRAPHQL_MUTATION = 'x-graphqlMutation',
  GRAPHQL_QUERY = 'x-graphqlQuery';

module.exports = Builder;

function Builder(app, graphqlEndpoint) {
  if (!(this instanceof Builder)) {
    return new Builder(app, graphqlEndpoint);
  }

  this.app = app;
  this.graphqlEndpoint = graphqlEndpoint;
}

// Add Validation of spec
Builder.prototype.buildAPI = function buildAPI(name, format, description, done) {
  var priorAPI,
    app = this.app;

  console.log('Building API');
  console.log(`Routes count: ${app._router.stack.length}`);

  // order is important here base on how express stack is built
  async.waterfall([
    this.removeExistingAPI(name, true),
    function (api, next) {
      priorAPI = api;
      next();
    },
    buildNewAPI(app, name, format, description, this.graphqlEndpoint),
  ], function (err, newAPI) {
    if (err) {
      console.log(err);

      recoverAPI(app, priorAPI, function () {
        console.log(`final routes: ${app._router.stack.length}`);
        done(err);
      });
    } else {
      console.log(`updated routes: ${app._router.stack.length}`);
      done(null, newAPI);
    }
  });
}

Builder.prototype.removeExistingAPI = function removeExistingAPI(name, ignoreNotFound) {
  var app = this.app;

  return function (done) {
    async.waterfall([
      removeAPI(name, ignoreNotFound),
      removeRoutes(app),
    ], function (err, removedAPI) {
      if (err) {
        if (ignoreNotFound) {
          recoverAPI(app, removedAPI, done);
        } else {
          done(err);
        }
      } else {
        if (removedAPI) {
          console.log(`removed API: ${name}`);
          console.log(`truncated routes: ${app._router.stack.length}`);
        }
        done(null, removedAPI);
      }
    });
  }
}

// TODO naive implementation mutating app._router.stack - make more robust, also brittle
function removeAPI(name, ignoreNotFound) {
  return function (done) {
    API.removeByName(name, function (err, api) {
      if (api) {
        done(null, api);
      } else {
        if (err && err.message == NOT_FOUND) {
          if (ignoreNotFound) {
            done(null, false);
          } else {
            done(err);
          }
        } else {
          console.log(err);
          done(err);
        }
      }
    });
  }
}

// TODO make this lower order
// This is brittle if changes in layer implementation of express
function removeRoutes(app) {
  return function (api, done) {
    if (!api) {
      done(null, false); // no routes to remove
      return
    }

    var removedRoutes = _.remove(app._router.stack, function (layer) {
      if (layer.route == undefined) {
        return false;
      } else {
        return api.matchesRoute(layer.route.path, layer.route.methods);
      }
    });

    if (removedRoutes && removedRoutes.length > 0) {
      console.log(`removed ${removedRoutes.length} routes`);
    }

    done(null, api);
  }
}

function buildNewAPI(app, name, format, description, graphqlEndpoint) {
  return function (done) {
    var newAPI = new API(name, format, description);

    async.waterfall([
      buildRoutes(app, newAPI, graphqlEndpoint),
      function (api, next) {
        api.save(next); // only persist if building routes succeeds
      }
    ], function (err, api) {
      if (err) {
        console.log(err);

        if (api) {
          removeRoutes(app)(api, done); // clear the routes, save failed
        } else {
          done(err); // failed at removing API
        }
      } else {
        done(null, api);
      }
    });
  }
}

// TODO validation of graphql queries
// Protection from malicious actors putting apiql description with changes
function buildRoutes(app, api, graphqlEndpoint) {
  return function (done) {
    api.forEachOperation(function (path, method, operation) {
      buildRoute(app, path, method, operation, graphqlEndpoint);
    });
    done(null, api);
  }
}

function buildRoute(app, path, method, operation, graphqlEndpoint) {
  switch (method.toLowerCase()) {
    case 'get':
      app.get(path, function (req, res, done) {
        sendGraphQL(graphqlEndpoint, operation, req, function (err, response, body) {
          if (err) {
            done(err);
          } else {
            res.status(response.statusCode).json(body);
            done();
          }
        });
      });
      break;
    case 'put':
      app.put(path, function (req, res, done) {
        sendGraphQL(graphqlEndpoint, operation, req, function (err, response, body) {
          if (err) {
            done(err);
          } else {
            res.sendStatus(204);
            done();
          }
        });
      });
      break;
    case 'post':
      app.post(path, bodyParser.json(), function (req, res, done) {
        sendGraphQL(graphqlEndpoint, operation, req, function (err, response, body) {
          if (err == null) {
            res.status(response.statusCode).json(body);
            done();
          } else {
            done(err);
          }
        });
      })
      break;
    case 'delete':
      app.delete(path, function (req, res, done) {
        sendGraphQL(graphqlEndpoint, operation, req, function (err, response, body) {
          if (err) {
            done(err);
          } else {
            res.sendStatus(204);
            done();
          }
        });
      });
      break;
    // TODO patch
    default:
      throw new Error('unsupport method in API Description: ' + method);
  }
}

function recoverAPI(app, api, done) {
  if (!api) {
    done();
    return
  }

  // add the same API back
  buildNewAPI(app, api.name, api.format, api.formattedDescription(api.format), function (err, recoveredAPI) {
    if (err) {
      if (recoveredAPI) {
        console.log('failed to restore prior API ' + api.name + ' routes: ' + err.message);
      } else {
        console.log('failed to restore prior API ' + api.name + ': ' + err.message);
      }
      done(err);
    } else {
      done(null, recoveredAPI);
    }
  })
}

function sendGraphQL(graphqlEndpoint, operation, req, done) {
  request.post(graphqlEndpoint, { json: buildPayload(operation, req) }, done); // just forward to graphql endpoint
}

function buildPayload(operation, req) {
  var payload = {
    operationName: operation.operationId,
    variables: _.merge(_.merge({}, req.params), req.query)
  };

  if (operation[GRAPHQL_QUERY] != undefined) {
    payload.query = operation[GRAPHQL_QUERY];
  } else if (operation[GRAPHQL_MUTATION] != undefined) {
    payload.query = operation[GRAPHQL_MUTATION];
    payload.variables = _.merge(payload.variables, req.body);
  } else {
    throw new Error(`no query or mutation defined for operation: ${operation}`);
  }
  return payload;
}
