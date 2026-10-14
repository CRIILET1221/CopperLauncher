const {invoke}=window.__TAURI__.core;
const el=id=>document.getElementById(id);
let busy=false,done=false,ready=false,clearData=false;
el('clear-data').onclick=()=>{
  if(busy)return;
  clearData=!clearData;
  el('clear-data').setAttribute('aria-pressed',String(clearData));
  el('clear-data').textContent=clearData?'Очистка данных включена':'Также удалить данные Copper';
};
function error(value){el('error').textContent=String(value);el('error').hidden=!value}
function progress({percent,stage}){el('fill').style.width=percent+'%';document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',percent);el('percent').textContent=percent+'%';el('stage').textContent=stage}
const close=()=>{if(!busy)invoke('close_uninstaller').catch(error)};
el('close').onclick=close;el('cancel').onclick=close;
el('action').onclick=async()=>{
  if(done){close();return}if(busy||!ready)return;
  busy=true;error('');el('action').disabled=true;el('close').disabled=true;el('cancel').disabled=true;el('clear-data').disabled=true;
  el('confirmation').hidden=true;el('progress').hidden=false;el('title').textContent='Удаляем Copper';el('action').textContent='Удаляем…';progress({percent:0,stage:'Проверка установки…'});
  try{
    await invoke('uninstall',{clearData});done=true;progress({percent:100,stage:'Copper удалён'});
    el('title').textContent='Copper удалён';el('subtitle').textContent=clearData?'Настройки, входы и кэш удалены. Инстансы и миры сохранены.':'Инстансы, миры и аккаунты сохранены.';
    el('action').textContent='Завершить';el('action').dataset.pixelIcon='check';el('cancel').hidden=true;
  }catch(e){error(e);el('confirmation').hidden=false;el('progress').hidden=true;el('title').textContent='Удаление не завершено';el('subtitle').textContent='Устрани причину ошибки или отключи очистку данных и повтори удаление.';el('action').textContent='Повторить';el('cancel').textContent='Закрыть';}
  finally{busy=false;el('action').disabled=false;el('close').disabled=false;el('cancel').disabled=false;el('clear-data').disabled=done}
};
(async()=>{
  try{await window.__TAURI__.event.listen('uninstall-progress',event=>progress(event.payload))}catch(e){error('Не удалось подключить прогресс: '+e);return}
  try{el('path').textContent=await invoke('installation_path');ready=true;el('action').disabled=false}catch(e){el('path').textContent='Установка не найдена';error(e)}
})();
