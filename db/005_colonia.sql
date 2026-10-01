-- =====================================================================
-- 005: colonia y municipio de cada incidencia
-- El backend los obtiene al crearse la incidencia (geocodificación inversa de Mapbox, la misma
-- llamada que ya trae la dirección) y los guarda aquí. Sirven para el mapa de calor y para
-- mostrar "Col. X, Municipio" en el panel. Ejecutar UNA vez en Supabase > SQL Editor.
-- El backend tolera que este script aún no esté aplicado (la dirección se guarda igual).
-- =====================================================================

alter table public.incidencias
  add column if not exists colonia   text check (char_length(colonia)   <= 120),
  add column if not exists municipio text check (char_length(municipio) <= 120);

-- Vista del panel: columnas nuevas AL FINAL (create or replace no permite reordenar)
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
  i.entorno_detalle,
  i.colonia,
  i.municipio
from public.incidencias i
join public.categorias c on c.id = i.categoria_id
left join lateral (
  select r.foto_url
  from public.reportes r
  where r.incidencia_id = i.id and r.foto_url is not null
  order by r.created_at
  limit 1
) f on true;
