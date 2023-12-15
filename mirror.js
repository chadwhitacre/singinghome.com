#!/usr/bin/env bun run
const fs = require('fs');
const path = require('path');
const https = require('https');
const jsdom = require('jsdom');
const prettier = require('prettier');

const { JSDOM } = jsdom;

const KEEPERS = [
  'assets.buttondown.email',
  'buttondown-attachments.s3.us-west-2.amazonaws.com',
  'buttondown.imgix.net',
  'singinghome.com',
]

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
    remove('link[href^="/static/form-"]');
    remove('link[href^="https://fonts.google"]'); // not actually used afaict
    remove('link[rel="alternate"]');
    remove('link[rel="manifest"]');
    remove('link[rel="preconnect"]');
    remove('link[rel="webmention"]');

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

    // modify pages
    remove('.subscribe-page-extras');
    remove('.email-detail__header a');
    remove('#subscribe-form');
    remove('.footer');
    remove('.email-detail__footer');
    remove('.email-teaser');

    function createHeader() {
      div = document.createElement('div');
      div.className = 'app page--subscribe';
      div.innerHTML = `
        <h1>
          <img
            class="newsletter-icon"
            src="/images/29d3e2e8-4d30-4324-903e-523d54a61f9c.png"
          />

          Singing Home
        </h1>

        <div class="newsletter-description">
          <p></p>
          <center>
            <p><i>Celebrating the life of Rod Whitacre</i></p>
          </center>
          <p></p>
          <p></p>
          <p style="text-align: center;">
            <a href="/">Home</a>
            &nbsp;✚&nbsp;
            <a href="/archive/">Archive</a>
            <br>
            <br>
          </p>
        </div>

        <style>
          .email-detail__header {
            border-bottom: 0;
            margin: 0;
            padding: 0;
          }
          .email-detail__header h1 {
            font-size: 2em;
          }
        </style>
      `;
      return div;
    }

    if (filepath.endsWith('/archive/index.html')) {
      remove('svg');
      var metadata = document.querySelectorAll('.email-metadata')
      for (var i=0, md; md=metadata[i]; i++) {
        md.innerHTML = md.querySelector('div div:nth-child(2)').innerHTML.trim();
        md.classList.remove('email-metadata');
      }

      var style = document.createElement('style');
      style.innerHTML = `
        .email-list {
          margin-bottom: 6em;
        }
        .email {
          margin-bottom: 0;
        }
      `;

      var list = document.querySelector('.email-list');
      var items = list.querySelectorAll('.email');
      for (var i=0, item; item=items[i]; i++) {
        list.prepend(item);
      }
      list.prepend(style)

      remove('.public-archive__header');
      document.querySelector('.app-container').prepend(createHeader());
    }

    var emailBody = document.querySelector('.email-detail__body')
    if (emailBody) {
      var p = document.createElement('p');
      p.style = "text-align: center;";
      p.innerHTML = `
        <br>
        <br>
        <br>
        <a href="/">Home</a>
        &nbsp;✚&nbsp;
        <a href="/archive/">Archive</a>
        <br>
        <br>
      `;
      emailBody.append(p);

      document.querySelector('.app-container').prepend(createHeader());
    }

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
