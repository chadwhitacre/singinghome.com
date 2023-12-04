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

async function download(url, destdir) {
  if (url.endsWith('/')) {
    var fnqs = '';
    var filename = 'index.html';
  } else {
    var fnqs = path.basename(url);
    var filename = fnqs, querystring = '';
  }

  if (fnqs.indexOf('?') > -1) {
    [filename, querystring] = fnqs.split('?');
    var emanelif = reverse(filename);
    var idx = emanelif.indexOf('.');
    var ext = reverse(emanelif.slice(0, idx));
    var fn = reverse(emanelif.slice(idx+1));
    fn = fn.replaceAll('_', '-').replaceAll('.', '-');
    part = querystring.replaceAll('=', '-').replaceAll('&', '-');
    filename = `${fn}-${part}.${ext}`
  }

  filepath = path.join(destdir, filename);
  if (!fs.existsSync(filepath)) {
    var file = fs.createWriteStream(filepath);
    console.log('downloading', url);
    await https.get(url, function(response) {
      response.pipe(file);
      file.on('finish', function() {
        file.close();
      });
    });
  }

  return filename;
}


download('https://singinghome.com/', '.')
