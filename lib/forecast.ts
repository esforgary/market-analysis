export type Observation={date:string;quote:string;rate:number};
export function forecast(history:Observation[],quote:string,now=Date.now()){
 const rows=history.filter(r=>r.quote===quote&&Number.isFinite(r.rate)&&r.rate>0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-61);
 if(rows.length<40)return null;
 const date=rows.at(-1)!.date;
 if(!Number.isFinite(Date.parse(date))||now-Date.parse(date)>7*86400000)return null;
 const returns=rows.slice(1).map((r,i)=>Math.log(rows[i].rate/r.rate));
 const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const variance=returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1);
 const drift=mean*22,spread=1.96*Math.sqrt(variance*22);
 return{quote,date,samples:returns.length,mid:Math.expm1(drift)*100,low:Math.expm1(drift-spread)*100,high:Math.expm1(drift+spread)*100};
}
