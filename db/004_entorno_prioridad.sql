-- =====================================================================
-- 004: prioridad ponderada por tipo de problema y por entorno
--   prioridad = min(10, prioridad_base + (reportes_count - 1) + entorno_bonus)
-- * prioridad_base (por categoría): Semáforos 5 > Obstrucciones 4 > Baches 3 > resto 1
-- * entorno_bonus (0 a 4): lo calcula el backend al crearse la incidencia, según lo que hay
--   a 250 m (hospitales/clínicas, educación, parques, asistencia social), y lo guarda con
--   aplicar_entorno(). La dirección se guarda en la columna `direccion` que ya existía.
-- Ejecutar UNA vez en Supabase > SQL Editor. El backend tolera que aún no esté aplicado.
-- =====================================================================

-- 0) Orden de importancia de las categorías (es un dato, no cambia el esquema)
update public.categorias
   set prioridad_base = case slug
         when 'semaforo'    then 5
         when 'obstruccion' then 4
         when 'bache'       then 3
         else 1
       end;

-- 1) Columnas nuevas (las incidencias existentes quedan con bonus 0)
alter table public.incidencias
  add column if not exists entorno_bonus   smallint not null default 0
    check (entorno_bonus between 0 and 4),
  add column if not exists entorno_detalle text
    check (char_length(entorno_detalle) <= 300);

-- 2) registrar_incidencia: misma firma que en 003; al agrupar conserva el bonus
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
    -- En el SET, reportes_count y entorno_bonus del lado derecho son los valores ANTERIORES
    update public.incidencias
       set reportes_count = reportes_count + 1,
           prioridad      = least(10, v_cat.prioridad_base + reportes_count + entorno_bonus)
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

revoke execute on function public.registrar_incidencia(smallint, double precision, double precision, text, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.registrar_incidencia(smallint, double precision, double precision, text, text, text, text)
  to service_role;

-- 3) aplicar_entorno: guarda el bonus (nunca lo baja) y recalcula la prioridad. Devuelve la prioridad nueva.
create or replace function public.aplicar_entorno(
  p_incidencia_id uuid,
  p_bonus         smallint,
  p_detalle       text default null
)
returns smallint
language plpgsql
set search_path = public, extensions
as $$
declare
  v_prioridad smallint;
begin
  update public.incidencias i
     set entorno_bonus   = greatest(i.entorno_bonus, p_bonus),
         entorno_detalle = case when p_bonus >= i.entorno_bonus then nullif(btrim(p_detalle), '') else i.entorno_detalle end,
         prioridad       = least(10, c.prioridad_base + i.reportes_count - 1 + greatest(i.entorno_bonus, p_bonus))
    from public.categorias c
   where i.id = p_incidencia_id
     and c.id = i.categoria_id
  returning i.prioridad into v_prioridad;

  return v_prioridad;
end;
$$;

revoke execute on function public.aplicar_entorno(uuid, smallint, text) from public, anon, authenticated;
grant  execute on function public.aplicar_entorno(uuid, smallint, text) to service_role;

-- 4) Vista del panel: columnas nuevas AL FINAL (create or replace no permite reordenar)
create or replace view public.v_incidencias_admin
with (security_invoker = true) as
select
  i.id,
  c.slug                                         as categoria,
  c.nombre                                       as categoria_nombre,
  i.estado,
  i.prioridad,
  i.reportes_count,
  extensions.st_y(i.ubicacion::extensions.geometry) as lat,
  extensions.st_x(i.ubicacion::extensions.geometry) as lon,
  i.direccion,
  i.created_at,
  i.atendida_at,
  i.motivo_rechazo,
  f.foto_url                                     as foto_principal,
  c.prioridad_base,
  i.entorno_bonus,
  i.entorno_detalle
from public.incidencias i
join public.categorias c on c.id = i.categoria_id
left join lateral (
  select r.foto_url
  from public.reportes r
  where r.incidencia_id = i.id and r.foto_url is not null
  order by r.created_at
  limit 1
) f on true;

-- 5) Recalcula la prioridad de las incidencias abiertas con los nuevos valores base
--    (las cerradas/rechazadas no se tocan). Se puede omitir si prefieres conservar las actuales.
update public.incidencias i
   set prioridad = least(10, c.prioridad_base + i.reportes_count - 1 + i.entorno_bonus)
  from public.categorias c
 where c.id = i.categoria_id
   and i.estado in ('pendiente', 'en_proceso');
