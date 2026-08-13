const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "dist");
const PORT = 4199;
const MIME = { ".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".gif":"image/gif",".ico":"image/x-icon",".woff2":"font/woff2",".wasm":"application/wasm",".map":"application/json" };

http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split("?")[0]);
  let f=path.join(ROOT,u);
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()) f=path.join(ROOT,"index.html");
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404);res.end("nf");return;}
    res.writeHead(200,{
      "Content-Type": MIME[path.extname(f)]||"application/octet-stream",
      "Cache-Control":"no-store"
    });
    res.end(d);
  });
}).listen(PORT,()=>console.log("serving dist on",PORT));
