const {invoke}=window.__TAURI__.core;
const el=id=>document.getElementById(id);
let current=0,installedPath='',busy=false,choosing=false;
function error(message){el('error').textContent=String(message);el('error').hidden=!message}
function view(n){current=n;['setup','install','finish'].forEach((id,i)=>{el(id).hidden=i!==n;el('s'+i).className='step'+(i===n?' active':i<n?' done':'')});el('action').textContent=['Установить','Устанавливаем…','Завершить'][n]}
function progress({percent,stage}){document.querySelector('.fill').style.width=percent+'%';document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',percent);el('percent').textContent=percent+'%';el('stage').textContent=stage;el('detail').textContent=percent<90?'Copper Launcher':'Ярлыки и параметры установки'}
el('close').onclick=()=>invoke('close_setup');
el('begin').onclick=()=>{el('welcome').hidden=true;el('layout').hidden=false};
el('browse').onclick=async()=>{if(choosing)return;choosing=true;el('browse').disabled=true;el('action').disabled=true;el('browse').textContent='Выбери папку в окне Windows…';error('');try{const path=await invoke('choose_folder');if(path)el('path').value=path}catch(e){error(e)}finally{choosing=false;el('browse').disabled=false;el('action').disabled=false;el('browse').textContent='Выбрать папку…'}};
el('action').onclick=async()=>{
  error('');if(busy||choosing)return;
  if(current===2){try{if(el('launch').checked)await invoke('launch',{path:installedPath});await invoke('close_setup')}catch(e){error(e)}return}
  if(!el('path').value.trim()){error('Укажи папку установки или нажми «Выбрать папку».');el('path').focus();return;}
  busy=true;el('action').disabled=true;el('close').disabled=true;view(1);progress({percent:0,stage:'Подготовка файлов…'});
  try{installedPath=await invoke('install',{path:el('path').value,desktop:el('desktop').checked,menu:el('menu').checked});el('summary').textContent='Установлено в '+installedPath;view(2)}catch(e){view(0);error(e)}finally{busy=false;el('action').disabled=false;el('close').disabled=false}
};
(async()=>{try{el('path').value=await invoke('default_path')}catch(e){error(e)}try{await window.__TAURI__.event.listen('install-progress',event=>progress(event.payload))}catch(e){error('Не удалось подключить прогресс: '+e)}})();
