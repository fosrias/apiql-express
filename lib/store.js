/**
 *  Copyright (c) 2018 Mark W. Foster
 *
 *  This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

'use strict'

const
  { NOT_FOUND } = require('./constants'),
  _ = require('lodash'),

  apis = {}; // TODO should persist this and load any existing APIs on a restart

// TODO persist in actual store
const addAPI = function (api, done) {
  apis[api.name] = api;
  done(null, api);
}

const findAPIbyName = function (name, done) {
  var api = apis[name];

  if (api) {
    done(null, api);
  } else {
    done(new Error(NOT_FOUND));
  }
}

const listAPIs = function (done) {
  done(null, _.values(apis));
}

const removeAPIbyName = function (name, done) {
  findAPIbyName(name, function (err, api) {
    if (api) {
      delete apis[name];
      done(null, api);
    } else {
      done(err);
    }
  });
}

module.exports = {
  addAPI,
  findAPIbyName,
  listAPIs,
  removeAPIbyName
}
