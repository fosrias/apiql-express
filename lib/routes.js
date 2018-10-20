/**
 *  Copyright (c) 2018 Mark W. Foster
 *
 *  This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

'use strict'

const
  API = require('./api'),
  Builder = require('./api_builder'),
  bodyParser = require('body-parser'),
  fs = require('fs'),
  { NOT_FOUND } = require('./constants'),
  path = require('path'),
  pug = require('pug'),
  URI = require('urijs'),
  yaml = require('js-yaml'),
  _ = require('lodash'),

  OPENAPI_JSON = 'application/openapi+json',
  OPENAPI_YAML = 'application/openapi+yaml',
  TARGET_PROTOCOL = 'http',
  TARGET_HOST = 'localhost',
  TARGET_PORT = 8080,
  TARGET_PATH = '/graphql',

  descriptionFilePath = path.join(__dirname, '..', 'api_description.yml'),
  docs = pug.compileFile(path.join(__dirname, 'templates', 'description.pug'));

var registered = false;

module.exports = function (context) {
  var targetEndpoint = configureEndpoint(context);

  return function (req, res, next) {
    if (!registered) {
      register(req.app, targetEndpoint);
      registered = true;
    }
    next();
  }
}

function configureEndpoint(context) {
  var targetProtocol = context && context.targetProtocol || process.env.APIQL_TARGET_PROTOCOL || TARGET_PROTOCOL,
    targetHost = context && context.targetHost || process.env.APIQL_TARGET_HOST || TARGET_HOST,
    targetPort = context && context.targetPort || process.env.APIQL_TARGET_PORT || TARGET_PORT,
    targetPath = context && context.targetPath || process.env.APIQL_TARGET_PATH || TARGET_PATH;

  var targetEndpoint = URI.build({
    protocol: targetProtocol,
    hostname: targetHost,
    port: targetPort,
    path: targetPath
  });

  console.log('Target GraphQL endpoint: ' + targetEndpoint);

  return targetEndpoint;
}

// Adds routes that build custom routes that forward to a graphQL endpoint
// TODO Add persistence and load APIs, if any during registration
// TODO be able to configure to load an API description at runtime and disable PUT and DELETE
function register(app, targetEndpoint) {
  var builder = new Builder(app, targetEndpoint);

  // create and update APIs
  app.put('/apiql/apis/:name', bodyParsers(), function (req, res, done) {
    builder.buildAPI(req.params.name, req.headers['content-type'], req.body, function (err) {
      if (err) {
        res.sendStatus(400);
      } else {
        res.sendStatus(204);
      }
      done();
    });
  });

  app.get('/apiql/apis', function (req, res, done) {
    API.listAPIs(function (err, apis) {
      if (err) {
        console.log(err);
      }
      res.format({
        json: function () {
          res.json({ items: _.map(apis, (api) => api.toJson()) }); // returns empty array even with error
        },
        default: function () {
          res.sendStatus(406);
        }
      });
      done();
    });
  });

  app.get('/apiql/apis/:name', function (req, res, done) {
    API.findByName(req.params.name, function (err, api) {
      if (err) {
        res.sendStatus(404);
      } else {
        res.format({
          html: function () {
            res.send(docs({ name: req.params.name, description: api.description }));
          },
          json: function () {
            res.json(api.toJson());
          },
          'application/openapi+json': function () {
            res.json(api.formattedDescription(OPENAPI_JSON));
          },
          'application/openapi+yaml': function () {
            res.send(api.formattedDescription(OPENAPI_YAML));
          },
          default: function () {
            res.sendStatus(406);
          }
        });
      }
      done();
    });
  });

  app.delete('/apiql/apis/:name', function (req, res, done) {
    builder.removeExistingAPI(req.params.name)(function (err) {
      if (err) {
        if (err.message == NOT_FOUND) {
          res.sendStatus(404);
        } else {
          res.status(500).send(err.message);
        }
      } else {
        res.sendStatus(204); // return the deleted item
      }
      done();
    });
  });

  // returns apiql OpenApi 3.0 API Description document or rendered documentation via conneg
  app.get('/apiql/api-description', function (req, res, done) {
    var description;

    try {
      description = yaml.safeLoad(fs.readFileSync(descriptionFilePath, 'utf8'));
    } catch (err) {
      console.log(err);
      res.status(500).send(err.message);
    }

    res.format({
      html: function () {
        res.send(docs({ name: 'APIQL Docs', description: description }));
      },
      'application/openapi+json': function () {
        res.send(description);
      },
      'application/openapi+yaml': function () {
        res.send(yaml.safeDump(description));
      },
      default: function () {
        res.sendStatus(406);
      }
    });
    done();
  });
}

function bodyParsers() {
  return [
    bodyParser.json({ type: OPENAPI_JSON }),
    bodyParser.text({ type: OPENAPI_YAML })
  ];
}
