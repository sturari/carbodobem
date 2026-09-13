create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('manutencao-pedidos-horaria')
where exists (select 1 from cron.job where jobname = 'manutencao-pedidos-horaria');

select cron.schedule(
  'manutencao-pedidos-horaria',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://project--58f6f86b-1d2b-449d-b777-7408cba43a69.lovable.app/api/public/cron/pedidos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'e207fdc1f44869fde4f68819e88b4d9c77ed8350c5601e1e'
    ),
    body := jsonb_build_object('reconciliar', true, 'expirar', true, 'horasExpiracao', 24),
    timeout_milliseconds := 20000
  );
  $$
);