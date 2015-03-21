/*eslint-disable no-shadow*/
'use strict';

var browserify = require('browserify');
var test = require('tape');
var vm = require('vm');

test('dep-case-verify', function(t) {

  var depCaseVerify = require('../');

  t.test('mac only', function(t) {
    t.equal(process.platform, 'darwin', 'tests only run on mac');
    t.end();
  });

  t.test('entry-ok', function(t) {
    t.plan(4);
    browserify('./test/fixtures/entry-ok')
      .plugin(depCaseVerify)
      .bundle(function(err, src) {
        t.ifError(err);
        var c = {console: { log: log }};
        vm.runInNewContext(src, c);
        function log(x) {
          t.equal(x.a, 'a');
          t.equal(x.B, 'B');
          t.equal(typeof x.underscore, 'function');
        }
      });
  });

  t.test('entry-ok with external', function(t) {
    t.plan(4);
    browserify('./test/fixtures/entry-ok')
      .plugin(depCaseVerify)
      .external('underscore')
      .bundle(function(err, src) {
        t.ifError(err);
        var c = {console: { log: log }, require: externalRequire};
        vm.runInNewContext(src, c);
        function externalRequire(name) {
          t.equal(name, 'underscore', 'require correct external module');
        }
        function log(x) {
          t.equal(x.a, 'a');
          t.equal(x.B, 'B');
        }
      });
  });

  t.test('entry-bad-user-module', function(t) {
    t.plan(2);
    browserify('./test/fixtures/entry-bad-user-module')
      .plugin(depCaseVerify)
      .bundle(function(err, src) {
        t.equal(String(err), 'Error: Unmatched case in "test/fixtures/entry-bad-user-module" for "./dep-b"');
        t.notOk(src);
      });
  });

  t.test('entry-bad-node-module', function(t) {
    t.plan(2);
    browserify('./test/fixtures/entry-bad-node-module')
      .plugin(depCaseVerify)
      .bundle(function(err, src) {
        t.equal(String(err), 'Error: Unmatched case in "test/fixtures/entry-bad-node-module" for "Underscore"');
        t.notOk(src);
      });
  });

  t.end();
});
