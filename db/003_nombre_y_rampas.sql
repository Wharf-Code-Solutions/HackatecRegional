-- =====================================================================
-- 003: nombre del ciudadano + categoría "Rampas dañadas"
-- Ejecutar UNA vez en Supabase > SQL Editor, ANTES de desplegar el backend
-- y el frontend que envían `nombre_ciudadano`.
-- =====================================================================

-- 1) Categoría: "Banquetas de accesibilidad dañadas" pasa a "Rampas dañadas"
update public.categorias
   set slug = 'rampa',
       nombre = 'Rampas dañadas'
 where slug = 'banqueta';

-- 2) Nombre de quien reporta (obligatorio en el formulario, pero nullable
--    en la BD para no romper los reportes que ya existen)
alter table public.reportes
  add column if not exists nombre_ciudadano text
  check (char_length(nombre_ciudadano) <= 100);

-- 3) registrar_incidencia con el parámetro nuevo p_nombre.
--    Se elimina la firma anterior: si convivieran las dos, una llamada sin
--    p_nombre sería ambigua.
drop function if exists public.registrar_incidencia(smallint, double precision, double precision, text, text, text);

create or replace function public.registrar_incidencia(
  p_categoria_id smallint,
  p_lat          double precision,
  p_lon          double precision,
  p_descripcion  text default null,
  p_foto_url     text default null,
  p_email        text default null,
  p_nombre       text default null
)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_cat        public.categorias%rowtype;
  v_inc        public.incidencias%rowtype;
  v_punto      geography;
  v_reporte_id uuid;
  v_agrupado   boolean := false;
begin
  if p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'Coordenadas inválidas' using errcode = '22023';
  end if;

  select * into v_cat
  from public.categorias c
  where c.id = p_categoria_id and c.activa;

  if not found then
    raise exception 'Categoría inválida o inactiva' using errcode = '22023';
  end if;

  v_punto := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;

  perform pg_advisory_xact_lock(hashtext('incidencia:' || p_categoria_id::text));

  select * into v_inc
  from public.incidencias i
  where i.categoria_id = p_categoria_id
    and i.estado in ('pendiente', 'en_proceso')
    and st_dwithin(i.ubicacion, v_punto, v_cat.radio_agrupacion_m)
  order by st_distance(i.ubicacion, v_punto)
  limit 1;

  if found then
    v_agrupado := true;
    update public.incidencias
       set reportes_count = reportes_count + 1,
           prioridad      = least(10, v_cat.prioridad_base + reportes_count)
     where id = v_inc.id
    returning * into v_inc;
  else
    insert into public.incidencias (categoria_id, ubicacion, prioridad)
    values (p_categoria_id, v_punto, v_cat.prioridad_base)
    returning * into v_inc;
  end if;

  insert into public.reportes (incidencia_id, descripcion, foto_url, ubicacion, email_ciudadano, nombre_ciudadano)
  values (v_inc.id, p_descripcion, p_foto_url, v_punto, p_email, nullif(btrim(p_nombre), ''))
  returning id into v_reporte_id;

  return jsonb_build_object(
    'incidencia_id',  v_inc.id,
    'reporte_id',     v_reporte_id,
    'agrupado',       v_agrupado,
    'reportes_count', v_inc.reportes_count,
    'prioridad',      v_inc.prioridad
  );
end;
$$;

-- 4) Permisos: solo el backend (service_role) puede ejecutarla
revoke execute on function public.registrar_incidencia(smallint, double precision, double precision, text, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.registrar_incidencia(smallint, double precision, double precision, text, text, text, text)
  to service_role;
