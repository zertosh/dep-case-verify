'use strict';

var fs = require('fs');
var path = require('path');

var AsyncCache = require('async-cache');
var through = require('through2');

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
    if (row.deps[key].indexOf(step) !== -1) {
      var err = new Error('Unmatched case in "' + id + '" for "' + key + '"');
      stream.emit('error', err);
      return true;
    }
  });
}

module.exports = function apply(b, opts) {

  // nothing to do if this isn't a mac
  if (process.platform !== 'darwin') {
    return;
  }

  // AsyncCache has a default "max" of "Infinity".
  // since this closure only lives for the duration of any
  // one "bundle()", it's safe to assume that the source file
  // directory listings won't change during a build
  var readdir = new AsyncCache({
    load: function(key, cb) {
      fs.readdir(key, cb);
    }
  });

  // assume that everything up to the cwd is valid
  var skipSteps = pathSteps(process.cwd());

  b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
    var stream = this;
    var depsKeys = Object.keys(row.deps);

    // nothing to do if no deps
    if (depsKeys.length === 0) {
      stream.push(row);
      next();
      return;
    }

    var steps = [];
    depsKeys.forEach(function(key) {
      pathSteps(row.deps[key]).forEach(function(step) {
        if (skipSteps.indexOf(step) === -1) {
          steps.push(step);
        }
      });
    });

    steps.forEach(function(step) {
      var basename = path.basename(step);
      var dirname = path.dirname(step);
      readdir.get(dirname, function(err, files) {
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
          next();
        }
      });
    });
  }));

  b.once('reset', function() {
    apply(b, opts);
  });
};
