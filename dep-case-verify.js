var fs = require('fs');
var path = require('path');
var through = require('through2');

// Turns "/a/b/c.js" into ["/a", "/a/b", "/a/b/c.js"]
function pathSteps(pathString) {
  return pathString
    .split('/')
    .map(function(part, i, parts) {
      return parts.slice(0, i+1).join('/');
    })
    .filter(Boolean);
}

function error(stream, row, step) {
  var id = path.relative(process.cwd(), row.id);
  var dep;
  Object.keys(row.deps).some(function(key) {
    if (row.deps[key].indexOf(step) !== -1) dep = key;
  });
  stream.emit('error', 'Unmatched case in "' + id + '" for "' + dep + '"');
}

module.exports = function apply(b, opts) {

  // nothing to do if this isn't a mac
  if (process.platform !== 'darwin') return;

  // keep track of the steps we've seen across rows to minimize
  // the calls to "fs.readdir"
  var seen = [];

  // assume that everything up to the cwd is valid
  [].push.apply(seen, pathSteps(process.cwd()));

  b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
    var self = this;
    var steps = [];

    Object.keys(row.deps).forEach(function(key) {
      pathSteps(row.deps[key]).forEach(function(step) {
        if (seen.indexOf(step) === -1) {
          seen.push(step);
          steps.push(step);
        }
      });
    });

    // nothing to do - no deps or we've seen it already
    if (steps.length === 0) {
      self.push(row);
      next();
      return;
    }

    var waiting = steps.length;

    steps.forEach(function(step) {
      var basename = path.basename(step);
      var dirname = path.dirname(step);
      fs.readdir(dirname, function(err, files) {
        if (files.indexOf(basename) === -1) {
          // don't emit the row if there is a mismatch
          // because it throws off watchify
          error(self, row, step);
        } else if (--waiting === 0) {
          self.push(row);
          next();
        }
      });
    });
  }));

  b.once('reset', function() {
    apply(b, opts);
  });
};
