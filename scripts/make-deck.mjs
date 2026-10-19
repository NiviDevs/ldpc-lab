import pptxgen from 'pptxgenjs';
import { slides } from '../dist/slides.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'The Signal Lab'; pptx.subject = 'Digital Communication Systems · Module 7';
pptx.title = 'LDPC Codes and Their Application in Modern Communication Systems';
pptx.company = 'DCS Seminar'; pptx.lang = 'en-IN';
pptx.theme = { headFontFace:'Georgia', bodyFontFace:'Aptos', lang:'en-IN' };
const C={paper:'E5D7B7',ink:'3C3836',green:'65713F',muted:'756B59',line:'C6B996',copper:'AF643C'};
const text=(slide,t,x,y,w,h,size=16,color=C.ink,more={})=>slide.addText(t,{x,y,w,h,fontFace:'Aptos',fontSize:size,color,margin:0,breakLine:false,paraSpaceAfterPt:0,vertAnchor:'top',...more});
const line=(slide,x1,y1,x2,y2,color=C.line,width=.7)=>slide.addShape(pptx.ShapeType.line,{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color,width,beginArrowType:'none',endArrowType:'none'}});
function picture(slide,name,x,y,w,h){
  const p=path.resolve('dist/assets/'+name);if(!existsSync(p))return;
  const png=readFileSync(p),pw=png.readUInt32BE(16),ph=png.readUInt32BE(20),scale=Math.min(w/pw,h/ph);
  slide.addImage({path:p,x:x+(w-pw*scale)/2,y:y+(h-ph*scale)/2,w:pw*scale,h:ph*scale});
}
function diagram(slide,x,y,w,h){
  const nodes=Array.from({length:8},(_,i)=>({x:x+i*w/7,y:y+.35+Math.sin(i*1.5)*.13}));
  const checks=Array.from({length:4},(_,i)=>({x:x+.2+i*(w-.4)/3,y:y+h-.3}));
  checks.forEach((c,j)=>{for(let k=0;k<4;k++){const v=nodes[(j*2+k)%8];line(slide,v.x,v.y,c.x,c.y,'CAD5BB',.8);}});
  nodes.forEach((p,i)=>{slide.addShape(pptx.ShapeType.ellipse,{x:p.x-.065,y:p.y-.065,w:.13,h:.13,fill:{color:i===3?'C99A76':'9EB787'},line:{color:i===3?C.copper:'819D68',width:.5}});text(slide,'x'+(i+1),p.x-.1,p.y-.32,.3,.2,10,C.muted,{fontFace:'Georgia',italic:true,align:'center'});});
  checks.forEach((p,i)=>{slide.addShape(pptx.ShapeType.rect,{x:p.x-.065,y:p.y-.065,w:.13,h:.13,fill:{color:'C5AD8F'},line:{color:'AB9273',width:.5}});text(slide,'c'+(i+1),p.x-.1,p.y+.13,.3,.2,10,C.muted,{fontFace:'Georgia',italic:true,align:'center'});});
}
slides.forEach((s,i)=>{
  const slide=pptx.addSlide();slide.background={color:C.paper};
  text(slide,'LDPC  /  THE SIGNAL LAB',.65,.3,5,.22,9,C.green,{fontFace:'Aptos Mono',charSpacing:1});
  text(slide,'DIGITAL COMMUNICATION SYSTEMS',8.7,.3,3.95,.2,8,C.muted,{align:'right',charSpacing:1});
  line(slide,.65,.7,12.68,.7);line(slide,.65,7,12.68,7);
  text(slide,'MODULE 07 · INFORMATION THEORY & CODING',.65,7.15,9,.18,8,C.muted,{charSpacing:1});
  text(slide,String(i+1).padStart(2,'0')+' / 16',11.3,7.13,1.35,.2,9,C.green,{align:'right',fontFace:'Aptos Mono'});
  text(slide,s.tag,.8,1,11.6,.23,9,C.muted,{fontFace:'Aptos Mono',charSpacing:1.5});
  if(i===0){
    text(slide,s.title,.8,1.7,7.9,2.1,51,C.ink,{fontFace:'Georgia',lineSpacingMultiple:1.05});
    text(slide,s.subtitle,.86,4.17,6.5,.8,19,C.muted,{breakLine:false});
    text(slide,'A visual journey from Hamming codes to the channel capacity limit.',.86,5.5,6.1,.6,14,C.green,{fontFace:'Georgia',italic:true});
    diagram(slide,8.4,2,3.55,3.8);
  } else {
    const visual={6:'channel-plot.png',7:'belief-plot.png',8:'graph-preview.png',10:'graph-preview.png',11:'ber-plot.png',12:'capacity-plot.png'}[i];
    text(slide,s.title.replace('\n',' '),.8,1.45,11.7,.9,34,C.ink,{fontFace:'Georgia',fit:'shrink'});
    text(slide,s.subtitle,.8,2.4,11.45,.75,16,C.muted,{fit:'shrink',breakLine:false});
    if(visual){
      const cols=s.columns||[];
      cols.forEach(([title,body],j)=>{const y=3.4+j*.95;text(slide,'0'+(j+1)+'  '+title,.85,y,5.2,.27,15,C.green,{bold:true});text(slide,body,.85,y+.34,5.1,.56,12,C.muted,{fit:'shrink'});});
      if(!cols.length)text(slide,s.formula||'',.85,3.6,5,1.6,25,C.green,{fontFace:'Georgia',italic:true});
      picture(slide,visual,6.5,3.2,5.85,2.95);
      if(i===11)text(slide,'Illustrative teaching code · 160 frames / point · ↓ indicates zero errors',6.65,6.25,5.5,.25,9,C.muted);
      else if(i===12)text(slide,'BPSK-constrained AWGN capacity, not a measured decoding threshold',6.65,6.25,5.5,.25,9,C.muted);
      else if(s.formula&&cols.length)text(slide,s.formula,.85,6.38,11.5,.35,17,C.green,{fontFace:'Georgia',italic:true,fit:'shrink'});
    }else{
      (s.columns||[]).forEach(([title,body],j)=>{
        const x=.85+j*4.05;line(slide,x,3.6,x+3.6,3.6,'BAC9AC');text(slide,'0'+(j+1),x,3.8,3.5,.2,9,C.copper,{fontFace:'Aptos Mono'});
        text(slide,title,x,4.15,3.55,.5,23,C.ink,{fontFace:'Georgia',fit:'shrink'});
        text(slide,body,x,4.85,3.5,1.1,14,C.muted,{fit:'shrink',breakLine:false});
      });
      if(s.formula)text(slide,s.formula,.85,6.2,11.5,.48,19,C.green,{fontFace:'Georgia',italic:true,fit:'shrink'});
      if(s.note&&!s.formula)text(slide,s.note,.85,6.2,11.5,.5,10,C.muted,{fit:'shrink'});
    }
    if(i===10){text(slide,'OPEN THE INTERACTIVE LAB ↗',.85,6.48,5.2,.25,11,C.green,{hyperlink:{url:'https://ldpc-signal-lab.heartyring65.chatgpt.site'}});}
  }
  slide.addNotes([s.speaker,s.note?'\nCaveat: '+s.note:'','\nLive lab: https://ldpc-signal-lab.heartyring65.chatgpt.site'].join('\n'));
});
await pptx.writeFile({ fileName:'dist/assets/LDPC-Seminar.pptx' });
console.log('Created editable 16-slide LDPC seminar deck with speaker notes.');
