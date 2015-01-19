# dep-case-verify

`dep-case-verify` is Browserify plugin for verifing dependency paths in non-case-sensitive environments. It works by getting a directory listing for each part of the dependency path, and making sure that it's listed as was required.

This solves the problem of where you develop on a Mac, your code bundles correctly, but then when you go build in a *nix environment, it doesn't work anymore because OS X is case-insensitive but your target is.

It's kinda hacky, I know.

## Usage

```js
var browserify = require('browserify');
var b = browserify({ /* stuff */ });
b.plugin(require('dep-case-verify'));
```
