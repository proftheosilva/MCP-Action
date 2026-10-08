"""Instala somente o SQL próprio do MCP Action. Credenciais nunca são impressas."""
from pathlib import Path
from dotenv import dotenv_values
import httpx
root=Path(__file__).resolve().parents[1]
env_file=Path(r'D:\workspace\Digital College\Professor\IA Generativa\chatgpt\output\pdf\RAG\projeto-RAG\.env')
v=dotenv_values(env_file)
ref=v['SUPABASE_URL'].split('//')[1].split('.')[0]
with httpx.Client(headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN']},timeout=60) as c:
 r=c.post('https://api.supabase.com/v1/projects/'+ref+'/database/query',json={'query':(root/'supabase/schema.sql').read_text(encoding='utf-8-sig'),'read_only':False})
 print('Instalação SQL: HTTP',r.status_code)
 if not r.is_success:
  try: print(r.json().get('message','Permissão insuficiente para instalar o schema.'))
  except Exception: print('Instalação não concluída.')
  raise SystemExit(1)
 print('Tabelas e funções instaladas.')
