#!/usr/bin/env node
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
    const document = (await JSDOM.fromFile(filepath)).window.document;
    const anchors = document.getElementsByTagName('a');

    for (var i=0, a; a=anchors[i]; i++) {
      a.removeAttribute('target');

      const base = `file://${process.cwd()}`
      if (a.href.startsWith(base)) {
        throw heck;
      }

      if (a.href.startsWith(src)) {
        a.href = '/' + a.href.slice(src.length-1);
      }

      if (a.href.endsWith('index.html')) {
        a.href = a.href.slice(0, -'index.html'.length);
      }
    }
  }

  async function download(url) {
    var filepath = dest + new URL(url).pathname;

    if (filepath.endsWith('/')) {
      var filepath = filepath + 'index.html';
    }

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

  download(src);
}

main('https://singinghome.com/', 'docs');
