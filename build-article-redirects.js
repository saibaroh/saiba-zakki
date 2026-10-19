const fs=require('fs');
const path=require('path');
const redirects=require('./lib/article-redirects.json');
for(const [source,target] of Object.entries(redirects)){
 const url=new URL(target);if(url.origin!=='https://saiba-zakki.com')throw Error('Unexpected migration target');
 const dir=path.join(__dirname,source);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>記事の移転先</title><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0;url=${target}"></head><body><p>この記事は才羽のザッキログに掲載しています。</p><a href="${target}">記事を読む</a></body></html>\n`);
}
