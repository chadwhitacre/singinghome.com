#!/usr/bin/env bun run
const fs = require('fs');
const path = require('path');
const https = require('https');
const jsdom = require('jsdom');
const prettier = require('prettier');

const { JSDOM } = jsdom;

const KEEPERS = ['singinghome.com', 'buttondown-attachments.s3.us-west-2.amazonaws.com', 'assets.buttondown.email']

function reverse(s) {
  return s.split('').reverse().join('');
}

function main(src, dest) {
  var dest = path.resolve(dest);

  async function recurse(filepath) {
    const dom = await JSDOM.fromFile(filepath)
    const document = dom.window.document;

    function remove(query) {
      var el;
      while(1) {
        el = document.querySelector(query);
        if (!el) break;
        el.parentNode.removeChild(el);
      }
    };

    remove('script');
    document.documentElement.style.setProperty("--tint-color", '#3b82f6');

    // <a>
    const anchors = document.getElementsByTagName('a');
    for (var i=0, a; a=anchors[i]; i++) {
      a.removeAttribute('target');
      if (a.href.startsWith(src)) {
        a.href = await download(a.href);
      }
    }

    // <link>
    remove('link[rel="webmention"]');
    remove('link[rel="alternate"]');
    remove('link[href^="/static/form-"]');

    const links = document.getElementsByTagName('link');
    for (var i=0, link; link=links[i]; i++) {
      if (link.rel === 'canonical')
        continue;
      if (link.href.startsWith('file:///')) {
        link.href = src + link.href.slice('file:///'.length);
      }
      link.href = await download(link.href);
    }

    // <img>
    const images = document.getElementsByTagName('img');
    for (var i=0, image; image=images[i]; i++) {
      image.src = await download(image.src);
    }

    // <meta>
    let meta
    meta = document.querySelector('meta[name="twitter:image"]');
    meta.content = await download(meta.content);

    meta = document.querySelector('meta[property="og:image"]');
    meta.content = await download(meta.content);

    // finish

    var html = dom.serialize();
    try {
      html = await prettier.format(html, {parser: 'html'});
    } catch {
      console.error('failed to prettify', filepath);
    }
    await fs.writeFile(filepath, html, () => {});
  }

  async function download(urlString) {
    var url = new URL(urlString);

    if (!KEEPERS.includes(url.hostname)) {
      console.log('  skipping', url.hostname);
      return urlString;
    }

    var urlpath =  url.pathname;
    var filepath = dest + urlpath;

    if (filepath.endsWith('/')) {
      var filepath = filepath + 'index.html';
    }

    if (!fs.existsSync(filepath)) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      var file = fs.createWriteStream(filepath);
      console.log('downloading', url.href);
      https.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
          file.close();
          if (filepath.endsWith('.html')) {
            recurse(filepath);
          }
        });
      });
    }
    return urlpath;
  }

  download(src);
}

const root = 'docs';
fs.renameSync('docs/CNAME', 'CNAME')
fs.rmSync(root, { recursive: true, force: true });
main('https://singinghome.com/', root);
fs.renameSync('CNAME', 'docs/CNAME')
