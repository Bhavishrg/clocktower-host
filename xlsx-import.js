/* Browser-only first-sheet .xlsx/CSV roster importer. JSZip is bundled locally. */
(function(root,factory){const value=factory(root);if(typeof module==='object'&&module.exports)module.exports=value;root.ClocktowerImport=value})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  function unescapeXml(s){return String(s).replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(Number(x))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
  function cols(ref){let n=0;for(const c of (ref.match(/^[A-Z]+/i)||[''])[0].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
  function extractText(xml){return [...xml.matchAll(/<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)].map(x=>unescapeXml(x[1])).join('')}
  function parseWorksheet(sheet,strings){
    const rows=[];
    for(const rowMatch of sheet.matchAll(/<(?:[\w.-]+:)?row\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?row>/g)){
      const cells=[];
      for(const cell of rowMatch[1].matchAll(/<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/g)){
        const ref=/\br="([A-Z]+\d+)"/i.exec(cell[1])?.[1],type=/\bt="([^"]+)"/.exec(cell[1])?.[1],content=cell[2]||'';
        if(!ref)continue;
        const raw=/<(?:[\w.-]+:)?v>([\s\S]*?)<\/(?:[\w.-]+:)?v>/.exec(content)?.[1]||'';
        cells[cols(ref)]=type==='s'?(strings[Number(raw)]||''):type==='inlineStr'?extractText(content):unescapeXml(raw);
      }
      if(cells.some(x=>String(x||'').trim()))rows.push(cells.map(x=>String(x||'').trim()));
    }
    return rows;
  }
  function csvRows(input){
    const rows=[];let row=[],value='',quoted=false;
    for(let i=0;i<input.length;i++){const c=input[i];if(quoted){if(c==='"'&&input[i+1]==='"'){value+='"';i++}else if(c==='"')quoted=false;else value+=c}
      else if(c==='"')quoted=true;else if(c===','){row.push(value);value=''}else if(c==='\n'){row.push(value);rows.push(row);row=[];value=''}else if(c!=='\r')value+=c}
    row.push(value);if(row.some(x=>x.trim()))rows.push(row);return rows;
  }
  function roster(rows){
    if(!rows.length)throw Error('Spreadsheet is empty');
    const h=rows[0].map(x=>String(x).trim().toLowerCase().replace(/[_-]/g,' '));
    const index=(names)=>h.findIndex(x=>names.includes(x));
    const name=index(['name','player','player name']);
    const role=index(['role','character','actual role','actual character']);
    const shown=index(['shown role','shown character','shown as','apparent role']);
    const team=index(['team','alignment']);
    if(name<0||role<0)throw Error('The first row needs Name and Role (or Character) columns');
    const out=rows.slice(1).filter(r=>String(r[name]||'').trim()).map(r=>({name:String(r[name]||'').trim(),actualRole:String(r[role]||'').trim(),shownRole:shown<0?'':String(r[shown]||'').trim(),alignment:team<0?'':String(r[team]||'').trim()}));
    if(!out.length)throw Error('No players found');
    if(out.length>15)throw Error('Maximum 15 players');
    if(out.some(x=>!x.actualRole))throw Error('Every player needs a role');
    if(new Set(out.map(x=>x.name.toLocaleLowerCase())).size!==out.length)throw Error('Player names must be unique');
    return out;
  }
  async function parseFile(file){
    if(file.size>5*1024*1024)throw Error('Choose a file smaller than 5 MB');
    if(/\.csv$/i.test(file.name))return roster(csvRows(await file.text()));
    if(!/\.xlsx$/i.test(file.name))throw Error('Use an .xlsx or .csv file');
    if(!root.JSZip)throw Error('Spreadsheet reader is unavailable');
    if(typeof root.setImmediate!=='function')root.setImmediate=(fn,...args)=>root.setTimeout(fn,0,...args);
    const zip=await root.JSZip.loadAsync(await file.arrayBuffer());
    const sheets=Object.keys(zip.files).filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort((a,b)=>Number(/sheet(\d+)/.exec(a)[1])-Number(/sheet(\d+)/.exec(b)[1]));
    if(!sheets.length)throw Error('No worksheet found');
    const strings=zip.file('xl/sharedStrings.xml')?await zip.file('xl/sharedStrings.xml').async('string'):'';
    const shared=[...strings.matchAll(/<(?:[\w.-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?si>/g)].map(x=>extractText(x[1]));
    const xml=await zip.file(sheets[0]).async('string');
    return roster(parseWorksheet(xml,shared));
  }
  return {parseFile,roster,parseWorksheet,csvRows};
});
