import './app.js';

// Reuse the authenticated dashboard controllers and their actions. Only presentation
// changes here: table rows become touch-sized cards, with all report fields retained.
const listState=new Map();
const make=(tag,className,text)=>{
  const el=document.createElement(tag);if(className)el.className=className;
  if(text!==undefined)el.textContent=text;return el;
};
function move(cell,into){if(cell)into.append(...cell.childNodes);return into;}
function cardFor(row,headers){
  const cells=[...row.cells],first=cells[0];
  if(cells.length===1){const empty=make('p','empty');move(first,empty);return empty;}
  const find=label=>headers.findIndex(h=>h===label);
  const statusIndex=headers.findIndex(h=>['Status','Status / role','Subscription','Visibility'].includes(h));
  const action=row.querySelector('[data-action="order"],[data-action="subscriber"],[data-accounts="detail"]');
  const title=make('strong'),copy=make('div','mobile-summary-copy'),end=make('div','mobile-summary-end');
  move(first,title);copy.append(title);
  if(action){
    const subtitle=headers[0]==='Order'?find('Customer'):find('Joined');
    if(subtitle>=0)copy.append(move(cells[subtitle],make('span')));
    if(statusIndex>=0){const status=move(cells[statusIndex],make('span','mobile-status'));end.append(status);}
    const amount=find(headers[0]==='Order'?'Net paid':'Net spend');
    if(amount>=0)end.append(move(cells[amount],make('b')));
    action.className='mobile-summary';action.type='button';action.replaceChildren(copy,end);
    return action;
  }
  const card=make('article','mobile-report-card'),head=make('div','mobile-card-head');
  head.append(copy,end);card.append(head);
  if(statusIndex>0)end.append(move(cells[statusIndex],make('span','mobile-status')));
  if(cells.length===2){end.append(move(cells[1],make('b')));return card;}
  const details=make('details','mobile-card-details'),summary=make('summary',null,'Details'),fields=make('dl');
  cells.forEach((cell,index)=>{
    if(index===0||index===statusIndex)return;
    if(cell.querySelector('button,a')&&!headers[index]){
      const actions=move(cell,make('div','mobile-card-actions'));card.append(actions);return;
    }
    const field=make('div');field.append(make('dt',null,headers[index]||'Information'),move(cell,make('dd')));fields.append(field);
  });
  if(fields.childElementCount){details.append(summary,fields);card.append(details);}
  return card;
}
function convertTables(){
  const route=document.querySelector('[data-mobile-route]')?.dataset.mobileRoute;
  if(!document.querySelector('.mobile-dock'))listState.clear();
  for(const [index,table] of [...document.querySelectorAll('#app table,#detail table')].entries()){
    const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    const rows=[...(table.tBodies[0]?.rows||[])];
    if(!headers.length)continue;
    const dialog=!!table.closest('dialog');
    const key=`${route}:${dialog?'detail':'page'}:${headers.join('|')}:${index}`;
    const state=listState.get(key)||{query:'',status:'',limit:25};
    listState.set(key,state);
    const wrapper=make('div','mobile-list'),cards=make('div','mobile-cards');
    const statusIndex=headers.findIndex(h=>['Status','Subscription','Visibility'].includes(h));
    const entries=rows.map(row=>{
      const search=row.textContent.toLocaleLowerCase();
      const status=statusIndex>=0?row.cells[statusIndex]?.textContent.trim()||'':'';
      return {search,status,card:cardFor(row,headers)};
    });
    const searchable=!dialog&&!['accounts','competition'].includes(route)&&(rows.length>5||['tickets','signups'].includes(route));
    if(searchable){
      const form=make('form','mobile-list-search'),input=make('input');input.type='search';input.placeholder='Search '+(headers[0]==='Order'?'orders':headers[0]==='Email address'?'email sign-ups':headers[0].toLowerCase());input.setAttribute('aria-label',input.placeholder);input.value=state.query;
      const submit=make('button','button', 'Search');submit.type='submit';form.append(input,submit);
      form.onsubmit=event=>{event.preventDefault();state.query=input.value.trim().toLocaleLowerCase();state.limit=25;update();};wrapper.append(form);
      const statuses=[...new Set(entries.map(e=>e.status).filter(Boolean))];
      if(statuses.length>1){const select=make('select','mobile-status-filter');select.setAttribute('aria-label','Filter '+headers[0].toLowerCase()+' status');select.append(new Option('All statuses',''));for(const status of statuses)select.append(new Option(status,status));select.value=state.status;select.onchange=()=>{state.status=select.value;state.limit=25;update();};wrapper.append(select);}
    }
    const count=make('p','mobile-list-count'),more=make('button','button mobile-load-more','Show more'),none=make('p','empty','No matching results.');more.type='button';
    entries.forEach(entry=>cards.append(entry.card));wrapper.append(cards,none,count,more);
    more.onclick=()=>{state.limit+=25;update();};
    function update(){
      let matching=0,visible=0;
      for(const entry of entries){const match=entry.search.includes(state.query)&&(!state.status||entry.status===state.status);if(match)matching++;entry.card.hidden=!match||matching>state.limit;if(!entry.card.hidden)visible++;}
      none.hidden=matching>0;more.hidden=matching<=state.limit;
      count.hidden=entries.length<=25&&!state.query&&!state.status;
      count.textContent=`${visible} of ${matching} results`;
    }
    update();table.replaceWith(wrapper);
  }
}
const observer=new MutationObserver(convertTables);
observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
observer.observe(document.querySelector('#detail'),{childList:true,subtree:true});
convertTables();
function network(){document.querySelector('#network-state').hidden=navigator.onLine;}
window.addEventListener('online',network);window.addEventListener('offline',network);network();
