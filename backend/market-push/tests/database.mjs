import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8'));
 let count=0;
 const prepare=(sql,args=[])=>({bind(...values){return prepare(sql,values)},async first(){count++;return db.prepare(sql).get(...args)||null},async all(){count++;return {results:db.prepare(sql).all(...args)}},async run(){count++;const value=db.prepare(sql).run(...args);return {meta:{changes:Number(value.changes)}}}});
 return {prepare,get queryCount(){return count},resetCount(){count=0},async batch(statements){db.exec('BEGIN');try{const out=[];for(const item of statements)out.push(await item.run());db.exec('COMMIT');return out}catch(error){db.exec('ROLLBACK');throw error}},close(){db.close()}};
}
