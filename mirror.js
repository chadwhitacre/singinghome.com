#!/usr/bin/env bun run
const fs = require('fs');
const path = require('path');
const https = require('https');
const jsdom = require('jsdom');
const prettier = require('prettier');

const { JSDOM } = jsdom;

function reverse(s) {
  return s.split('').reverse().join('');
}

function main(src, dest) {
  var dest = path.resolve(dest);

  async function recurse(filepath) {
    const dom = await JSDOM.fromFile(filepath)
    const document = dom.window.document;
    const anchors = document.getElementsByTagName('a');

    for (var i=0, a; a=anchors[i]; i++) {
      a.removeAttribute('target');
      if (a.href.startsWith(src)) {
        download(a.href);
        a.href = '/' + a.href.slice(src.length);
      }
    }

    var html = dom.serialize();
    html = await prettier.format(html, {parser: 'html'});
    await fs.writeFile(filepath, html, () => {});
  }

  async function download(url) {
    var filepath = dest + new URL(url).pathname;

    if (filepath.endsWith('/')) {
      var filepath = filepath + 'index.html';
    }

    if (!fs.existsSync(filepath)) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      var file = fs.createWriteStream(filepath);
      console.log('downloading', url);
      https.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
          file.close();
          recurse(filepath);
        });
      });
    }
  }

  download(src);
}

const root = 'docs';
fs.rmSync(root, { recursive: true, force: true });
main('https://singinghome.com/', root);
