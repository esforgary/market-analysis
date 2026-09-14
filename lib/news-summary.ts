export function contextExcerpt(text:string,maxLength=1100){
 const normalized=text.replace(/\s+/g,' ').trim();if(normalized.length<=maxLength)return normalized;
 const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(normalized)].map(s=>s.segment.trim());
 const selected=new Set<number>();let length=0;
 for(let i=0;i<sentences.length;i++){const important=i<2||/\b(but|however|although|risk|warn|forecast|expects?|could|may|declin|debt|loss|uncertain)\b/i.test(sentences[i]);if(important&&length+sentences[i].length<=maxLength){selected.add(i);length+=sentences[i].length+1}}
 if(!selected.size)return sentences[0]||normalized;
 return sentences.filter((_,i)=>selected.has(i)).join(' ');
}
