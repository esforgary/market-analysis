/** A trading axis assigns one slot per observed bar; wall-clock gaps do not create empty slots. */
export function createTradingScale(count:number,left:number,width:number){
 const size=Math.max(0,Math.floor(Number.isFinite(count)?count:0));
 const span=Math.max(0,Number.isFinite(width)?width:0);
 const start=Number.isFinite(left)?left:0;
 const step=size?span/size:0;
 const clamp=(index:number)=>Math.max(0,Math.min(size-1,Number.isFinite(index)?index:0));
 return {
  step,
  xAt(index:number){return size?start+(clamp(index)+.5)*step:start+span/2},
  indexAt(x:number){return size&&step?clamp(Math.floor((x-start)/step)):0},
 };
}
