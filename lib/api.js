/**
 *  Copyright (c) 2018 Mark W. Foster
 *
 *  This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

'use strict';

const
  store = require('./store'),
  URITemplate = require('urijs/src/URITemplate'),
  yaml = require('js-yaml'),
  _ = require('lodash'),

  PATH_REGEX = /^{[a-zA-Z0-9\.\-_]+}$/g;

module.exports = API;

function API(name, format, description) {
  if (!(this instanceof API)) {
    return new API(name, format, description);
  }

  this.name = name;
  this.format = format;
  this.description = jsonDescription(format, description); // always convert to json for internal use and persistence TODO minify this
}

API.findByName = function findByName(name, done) {
  store.findAPIbyName(name, function (err, api) {
    if (err) {
      done(err);
    } else {
      done(null, API.fromJson(api));
    }
  });
}

API.removeByName = function removeByName(name, done) {
  store.removeAPIbyName(name, function (err, api) {
    if (err) {
      done(err);
    } else {
      done(null, API.fromJson(api));
    }
  });
}

API.listAPIs = function listAPIs(done) {
  store.listAPIs(function (err, apis) {
    if (err) {
      done(err);
    } else {
      done(null, _.map(apis, API.fromJson));
    }
  });
}

API.fromJson = function fromJson(object) {
  return new API(object.name, object.format, formatDescription(object.format, object.description));
}

API.prototype.save = function save(done) {
  store.addAPI(this.toJson(), done);
}

API.prototype.toJson = function toJson() {
  return {
    name: this.name,
    format: this.format,
    description: this.description
  };
}

API.prototype.formattedDescription = function formattedDescription(format) {
  return formatDescription(format, this.description);
}

// iterator over each operation in the API
// should memoize
// maybe make proper iterator that can break for next method
API.prototype.forEachOperation = function forEachOperation(done) {
  _.forOwn(this.description.paths, function (operations, path) {
    var expressPath = convertPaths(path);

    _.forOwn(operations, function (operation, method) {
      done(expressPath, method, operation, this);
    });
  });
}

// Optimize this
API.prototype.matchesRoute = function matchesRoute(otherPath, otherMethods) {
  var matches = false;

  this.forEachOperation(function (path, method) {
    if (path == otherPath && otherMethods[method.toLowerCase()]) {
      matches = true;
      // TODO be able to break
    }
  });

  return matches;
}

function formatDescription(format, description) {
  switch (format) {
    case 'application/openapi+json':
      return description;
    case 'application/openapi+yaml':
      return yaml.safeDump(description);
    default:
      throw new Error(`unknown description format: ${format}`);
  }
}

// private helper methods
function jsonDescription(format, description) {
  switch (format) {
    case 'application/openapi+json':
      if (typeof description == object) {
        return description;
      } else {
        throw new Error(`application/openapi+json description ${description} is not an object`);
      }
    case 'application/openapi+yaml':
      return yaml.safeLoad(description);
    default:
      throw new Error(`Unknown format: ${format} for ${description}`);
  }
}

// Convert URI template path elements to express paths
// TODO this need work and tests move to utils.js
function convertPaths(path) {
  var pathTemplate = new URITemplate(path).parse(), // must call parse to populate parts
    expressPath = '';

  _.forEach(pathTemplate.parts, function (part) {
    switch (typeof part) {
      case 'string':
        if (part.length > 0) {
          expressPath += part;
        }
        break;
      case 'object':
        if (part.expression.length > 0 && part.expression.match(PATH_REGEX)) {
          expressPath += ':' + _.first(part.variables).name;
        }
        break;
      default:
      // TODO throw error
    }
  });

  return expressPath;
}
