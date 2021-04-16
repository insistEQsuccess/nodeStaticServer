const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const zlib = require('zlib');

const mime = require('mime');
const template = require('art-template');

Buffer.prototype.split = Buffer.prototype.split || function (sp) {
  let start=0;
  let n=0;
  let arr=[];
  while((n=this.indexOf(sp,start))!=-1){
    arr.push(this.slice(start,n));
    start = n + sp.length;
  }
  arr.push(this.slice(start));
  return arr;
};

let cwd = process.argv[2] || __dirname;
if(process.argv[2]){
  process.chdir(cwd);
}

function getHtml(data){
  return template(path.join(__dirname + '/template/index.art'), data)
}

http.createServer(function (req, res) {
  let {pathname} = url.parse(req.url);
  if(pathname == '/favicon.ico') return res.end();
  console.log(req.method, pathname);
  if(req.method == "GET"){
    let filePath = path.join(cwd,pathname);
    console.log(`请求地址是：${filePath}`);
    fs.stat(filePath, (err, stat)=>{
      if(stat.isDirectory()){
        let list = fs.readdirSync(filePath);
        let html = getHtml({list, filePath: pathname=='/'?'':pathname});
        res.setHeader('Content-Type','text/html');
        res.end(html);
      }else{
        res.setHeader('Content-Type', mime.getType(filePath)+';charset=utf-8');
        let zip = req.headers['accept-encoding'];
        let ifModifiedSince = req.headers['if-modified-since'];
        let ifNoneMatch = req.headers['if-none-match'];
        if(ifModifiedSince && stat.ctime.toGMTString() == ifModifiedSince){
          res.writeHead(304,{
            'Last-Modified': stat.ctime.toGMTString(),
            'Cache-Control': 'private,max-age=60',
            'Expires': new Date(Date.now() + 60*1000).toGMTString()
          });
          return res.end('');
        }
        if(ifNoneMatch && stat.size == ifNoneMatch){
          res.writeHead(304, {
            'ETag': stat.size,
            'Cache-Control': 'private,max-age=60',
            'Expires': new Date(Date.now() + 60*1000).toGMTString()
          });
          return res.end('');
        }
        if(!ifModifiedSince || !ifNoneMatch){
          res.setHeader('Cache-Control', 'private,max-age=60');
          res.setHeader('Expires', new Date(Date.now() + 60*1000).toGMTString());
          res.setHeader('Last-Modified', stat.ctime.toGMTString());
          res.setHeader('ETag', stat.size);
          if(/\bgzip\b/.test(zip)){
            res.setHeader('Content-Encoding', 'gzip');
            fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
          }else if(/\bdeflate\b/.test(zip)){
            res.setHeader('Content-Encoding', 'deflate');
            fs.createReadStream(filePath).pipe(zlib.createDeflate()).pipe(res);
          }else{
            fs.createReadStream(filePath).pipe(res);
          }
        }
      }
    })
  }else if(req.method == "POST"){
    if(pathname == '/upload/file'){
      let body = [];
      req.on('data', function (chunk) {
        body.push(chunk)
      });
      req.on('end', function () {
        let all = Buffer.concat(body);
        let boundary = '--'+req.headers['content-type'].split('; ')[1].slice('boundary='.length);
        let arr1 = all.split(boundary);
        arr1.shift();
        arr1.pop();
        let obj = {};
        arr1 = arr1.map(it => {
          it = it.slice(2, it.length-2);
          it = it.split('\r\n\r\n');
          let cur = it[0];
          let key = cur.toString('utf8').split('; ')[1].split('=')[1].replace(/"|'/g,'');
          if(cur.indexOf('\r\n')!=-1){
            let line = cur.toString('utf8').split('\r\n');
            let filename = line[0].split('; ')[2].split('=')[1].replace(/"|'/g,'');
            let contentType = line[1].split(': ')[1];
            fs.writeFile(path.resolve(cwd, 'uploadFiles', filename), it[1], err => {

            });
          }else{
            let data = it[1];
            obj[key] = data.toString('utf8');
          }
        });
        console.log(obj);
        res.setHeader('Content-Type', 'text/plain;charset=utf-8');
        res.end(JSON.stringify(obj));
      })
    }
  }
}).listen(8005, 'localhost', function () {
  console.log('static server is listening at http://localhost:8005');
});

