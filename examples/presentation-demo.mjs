import { selectAccounts } from '../dist/surfaces/fanout.js';
const accounts = [
  {id:'work',surfaces:['gmail','calendar'],profile:{email:'work@example.test'},tokenRef:'demo-work'},
  {id:'personal',surfaces:['gmail','drive'],profile:{email:'personal@example.test'},tokenRef:'demo-personal'},
  {id:'calendar-only',surfaces:['calendar'],profile:{email:'calendar@example.test'},tokenRef:'demo-calendar'},
];
for (const [surface,id] of [['gmail','*'],['gmail','personal'],['calendar','*'],['drive','work']]) {
  console.log(JSON.stringify({surface,account_id:id,selected:selectAccounts(accounts,surface,id).map(account=>account.id)}));
}
console.log('Scope: actual account-routing function on synthetic metadata; no OAuth, keychain or Google API access.');
