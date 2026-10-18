const {invoke}=window.__TAURI__.core;
const el=id=>document.getElementById(id);
let current=0,installedPath='',busy=false,choosing=false,updating=false;
function error(message){el('error').textContent=String(message);el('error').hidden=!message}
function labels(){return updating?['Обновить','Обновляем…','Завершить']:['Установить','Устанавливаем…','Завершить']}
function view(n){el('action').dataset.pixelIcon=n===2?'check':n===1?'refresh':updating?'refresh':'download';current=n;['setup','install','finish'].forEach((id,i)=>{el(id).hidden=i!==n;el('s'+i).className='step'+(i===n?' active':i<n?' done':'')});el('action').textContent=labels()[n]}
function progress({percent,stage}){document.querySelector('.fill').style.width=percent+'%';document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',percent);el('percent').textContent=percent+'%';el('stage').textContent=stage;el('detail').textContent=percent<90?'Copper Launcher':'Ярлыки и параметры установки'}
/// Copper уже установлен: вместо выбора папки — обновление поверх, ярлыки и данные остаются.
function updateMode(existing,version){
  updating=true;
  el('welcome').hidden=true;el('layout').hidden=false;
  document.querySelector('#setup h2').textContent='Обновление Copper';
  document.querySelector('#setup .sub').innerHTML='';
  document.querySelector('#setup .sub').append('Copper уже установлен'+(existing.version?' (версия '+existing.version+')':'')+'. Заменим файлы версией '+version+'.',document.createElement('br'),'Миры, сборки, аккаунты и ярлыки останутся.');
  el('path').value=existing.path;el('path').readOnly=true;
  ['browse','desktop','menu'].forEach(id=>{const n=el(id);(n.closest('label')||n).hidden=true});
  document.querySelector('#install h2').textContent='Обновляем Copper';
  document.querySelector('#finish h2').textContent='Copper обновлён!';
  document.querySelector('#finish .sub').textContent='Новая версия готова к запуску.';
  el('s0').lastChild.textContent='Обновление';el('s1').lastChild.textContent='Замена файлов';
  el('hint').textContent='Обновление для текущего пользователя';
  view(0);
}
el('close').onclick=()=>invoke('close_setup');
el('begin').onclick=()=>{el('welcome').hidden=true;el('layout').hidden=false};
el('browse').onclick=async()=>{if(choosing)return;choosing=true;el('browse').disabled=true;el('action').disabled=true;el('browse').textContent='Выбери папку в окне Windows…';error('');try{const path=await invoke('choose_folder');if(path)el('path').value=path}catch(e){error(e)}finally{choosing=false;el('browse').disabled=false;el('action').disabled=false;el('browse').textContent='Выбрать папку…'}};
el('action').onclick=async()=>{
  error('');if(busy||choosing)return;
  if(current===2){try{if(el('launch').checked)await invoke('launch',{path:installedPath});await invoke('close_setup')}catch(e){error(e)}return}
  if(!updating&&!el('path').value.trim()){error('Укажи папку установки или нажми «Выбрать папку».');el('path').focus();return;}
  busy=true;el('action').disabled=true;el('close').disabled=true;view(1);progress({percent:0,stage:'Подготовка файлов…'});
  try{installedPath=updating?await invoke('update'):await invoke('install',{path:el('path').value,desktop:el('desktop').checked,menu:el('menu').checked});el('summary').textContent=(updating?'Обновлено в ':'Установлено в ')+installedPath;view(2)}catch(e){view(0);error(e)}finally{busy=false;el('action').disabled=false;el('close').disabled=false}
};
(async()=>{
  try{await window.__TAURI__.event.listen('install-progress',event=>progress(event.payload))}catch(e){error('Не удалось подключить прогресс: '+e)}
  // Тихое обновление из лаунчера не удалось — окно показывается с ошибкой и кнопкой «Обновить».
  try{await window.__TAURI__.event.listen('update-failed',event=>{busy=false;el('action').disabled=false;el('close').disabled=false;view(0);error(event.payload)})}catch{}
  try{
    const mode=await invoke('setup_mode');
    if(mode.existing){updateMode(mode.existing,mode.version);if(mode.error)error(mode.error);else if(mode.auto_update)el('action').click();return}
  }catch(e){error(e)}
  try{el('path').value=await invoke('default_path')}catch(e){error(e)}
})();
