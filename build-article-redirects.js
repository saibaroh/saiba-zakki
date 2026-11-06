const fs=require('fs');
const path=require('path');
const redirects=require('./lib/article-redirects.json');
for(const [source,target] of Object.entries(redirects)){
 const url=new URL(target);
 const isProblem=url.origin==='https://shogi.saiba-zakki.com' && /^\/ja\/problems\/\d+\/$/.test(url.pathname);
 if(url.origin!=='https://saiba-zakki.com' && !isProblem)throw Error('Unexpected migration target');
 const message=isProblem?'この記事は将棋の問題集へ移設しました。':'この記事は才羽のザッキログに掲載しています。';
 const dir=path.join(__dirname,source);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>記事の移転先</title><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0;url=${target}"></head><body><p>${message}</p><a href="${target}">記事を読む</a></body></html>\n`);
}
