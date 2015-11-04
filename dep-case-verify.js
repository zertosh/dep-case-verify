'use strict';

var AsyncCache = require('async-cache');
var fs = require('fs');
var path = require('path');
var stream = require('stream');
var util = require('util');

var isDarwin = process.platform === 'darwin';

module.exports = function apply(b, opts) {
  // nothing to do if this isn't a mac
  if (!isDarwin) return;
  b.pipeline.get('deps').push(new DepCaseVerify());
  b.once('reset', function() {
    apply(b, opts);
  });
};

module.exports.DepCaseVerify = DepCaseVerify;
util.inherits(DepCaseVerify, stream.Transform);

function DepCaseVerify() {
  if (!(this instanceof DepCaseVerify)) {
    return new DepCaseVerify();
  }

  stream.Transform.call(this, {objectMode: true});
  // TODO: Use browserify basedir instead
  this.skipSteps = pathSteps(process.cwd());

  // AsyncCache has a default "max" of "Infinity".
  // since this instance only lives for the duration of any
  // one "bundle()", it's safe to assume that the source file
  // directory listings won't change during a build
  this.readdir = new AsyncCache({
    load: function(key, cb) {
      fs.readdir(key, cb);
    }
  });
}

DepCaseVerify.prototype._transform = function(row, enc, callback) {
  var stream = this;
  var steps = [];

  Object.keys(row.deps).forEach(function(key) {
    // external modules have a value of "false"
    if (typeof row.deps[key] === 'string') {
      pathSteps(row.deps[key]).forEach(function(step) {
        if (stream.skipSteps.indexOf(step) === -1) {
          steps.push(step);
        }
      });
    }
  });

  // nothing to do
  if (steps.length === 0) {
    stream.push(row);
    callback();
    return;
  }

  steps.forEach(function(step) {
    var basename = path.basename(step);
    var dirname = path.dirname(step);
    stream.readdir.get(dirname, function(err, files) {
      if (err) {
        stream.emit('error', err);
        return;
      }
      if (files.indexOf(basename) === -1) {
        // don't emit the broken row because that'll
        // trip up watchify
        error(stream, row, step);
        return;
      }
      steps.splice(steps.indexOf(step), 1);
      if (steps.length === 0) {
        stream.push(row);
        callback();
      }
    });
  });
};

// turns "/a/b/c.js" into ["/a", "/a/b", "/a/b/c.js"]
function pathSteps(pathString) {
  return pathString
    .split('/')
    .map(function(part, i, parts) {
      return parts.slice(0, i + 1).join('/');
    })
    .filter(Boolean);
}

function error(stream, row, step) {
  var id = path.relative(process.cwd(), row.id);
  Object.keys(row.deps).some(function(key) {
    if (typeof row.deps[key] === 'string' && row.deps[key].indexOf(step) !== -1) {
      var err = new Error('Unmatched case in "' + id + '" for "' + key + '"');
      stream.emit('error', err);
      return true;
    }
  });
}
